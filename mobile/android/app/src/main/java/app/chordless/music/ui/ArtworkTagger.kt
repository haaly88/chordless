package app.chordless.music.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.graphics.drawable.toBitmap
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * On-device artwork classification.
 *
 * The album art is run through a bundled EfficientNet-Lite model to derive
 * "vibe" tags for the current track — everything happens locally, no artwork
 * ever leaves the device.
 */
object ArtworkTagger {

    private const val TAG = "ArtworkTagger"
    private const val SIZE = 224
    private const val CLASSES = 1000

    data class Vibe(val label: String, val score: Float)

    /** ImageNet word -> music flavoured tag. */
    private val VIBE_RULES: List<Pair<String, String>> = listOf(
        "guitar" to "Guitar",
        "piano" to "Piano",
        "grand piano" to "Piano",
        "drum" to "Drums",
        "saxophone" to "Sax",
        "violin" to "Strings",
        "cello" to "Strings",
        "banjo" to "Folk",
        "microphone" to "Vocal",
        "stage" to "Live stage",
        "concert" to "Concert",
        "headphone" to "Headphones",
        "speaker" to "Speakers",
        "radio" to "Radio",
        "disk" to "Vinyl",
        "cassette" to "Tape",
        "sunglasses" to "Retro",
        "cowboy hat" to "Country",
        "t-shirt" to "Street",
        "suit" to "Classic",
        "jersey" to "Sporty",
        "soccer ball" to "Sporty",
        "basketball" to "Sporty",
        "surfboard" to "Surf",
        "skateboard" to "Street",
        "mountain" to "Outdoor",
        "valley" to "Outdoor",
        "beach" to "Beach",
        "coral reef" to "Underwater",
        "lakeside" to "Nature",
        "forest" to "Nature",
        "sunset" to "Golden hour",
        "sunrise" to "Morning",
        "starry night" to "Night sky",
        "night sky" to "Night sky",
        "fire" to "Fire",
        "neon" to "Neon",
        "barber shop" to "Soul",
        "restaurant" to "Dining",
        "coffee" to "Coffee",
        "beer" to "Night out",
        "wine" to "Night out",
        "disco" to "Disco",
        "ballpoint" to "Writing",
        "envelope" to "Writing",
        "book" to "Storytelling",
        "comic book" to "Storytelling",
        "poster" to "Art",
        "graffiti" to "Urban",
        "mural" to "Urban",
        "street sign" to "City",
        "sky" to "Airy",
        "cloud" to "Dreamy",
        "rain" to "Melancholy",
        "snow" to "Winter",
        "palm" to "Tropical",
        "jewelry" to "Luxury",
        "perfume" to "Luxury",
        "candle" to "Warm",
        "lantern" to "Warm",
        "shield" to "Epic",
        "sword" to "Epic",
        "crane" to "Epic",
        "volcano" to "Epic",
        "dome" to "Grand",
        "palace" to "Grand",
        "castle" to "Grand",
    )

    private var interpreter: Interpreter? = null
    private var labels: Array<String>? = null

    private fun ensureInterpreter(context: Context): Interpreter? {
        interpreter?.let { return it }
        return runCatching {
            val model = context.assets.open("efficientnet_lite0.tflite").use { it.readBytes() }
            val buffer = ByteBuffer.allocateDirect(model.size).order(ByteOrder.nativeOrder())
            buffer.put(model)
            buffer.rewind()
            val created = Interpreter(buffer, Interpreter.Options().setNumThreads(2))
            interpreter = created
            created
        }.onFailure { Log.w(TAG, "model unavailable: ${it.message}") }.getOrNull()
    }

    private fun loadLabels(context: Context): Array<String> {
        labels?.let { return it }
        val loaded = runCatching {
            context.assets.open("imagenet_labels.txt").bufferedReader().useLines { lines ->
                lines.map { it.trim() }.filter { it.isNotEmpty() }.toList().toTypedArray()
            }
        }.getOrDefault(emptyArray())
        labels = loaded
        return loaded
    }

    /** Download + classify the artwork for [artworkUrl]. */
    suspend fun tag(context: Context, artworkUrl: String): List<Vibe> = withContext(Dispatchers.IO) {
        if (artworkUrl.isBlank()) return@withContext emptyList()
        val bitmap = loadBitmap(context, artworkUrl) ?: return@withContext emptyList()
        try {
            classify(context, bitmap)
        } catch (e: Exception) {
            Log.w(TAG, "classification failed: ${e.message}")
            emptyList()
        } finally {
            if (!bitmap.isRecycled) bitmap.recycle()
        }
    }

    private suspend fun loadBitmap(context: Context, url: String): Bitmap? {
        return runCatching {
            val loader = ImageLoader(context)
            val request = ImageRequest.Builder(context)
                .data(url)
                .size(SIZE * 2)
                .allowHardware(false)
                .build()
            val result = loader.execute(request)
            (result as? SuccessResult)?.drawable?.toBitmap()?.let { bitmap ->
                bitmap.copy(Bitmap.Config.ARGB_8888, false)
            }
        }.getOrNull()
    }

    private fun classify(context: Context, bitmap: Bitmap): List<Vibe> {
        val net = ensureInterpreter(context) ?: return emptyList()
        val names = loadLabels(context)
        if (names.isEmpty()) return emptyList()

        val scaled = Bitmap.createScaledBitmap(bitmap, SIZE, SIZE, true)
        val pixels = IntArray(SIZE * SIZE)
        scaled.getPixels(pixels, 0, SIZE, 0, 0, SIZE, SIZE)
        if (scaled !== bitmap) scaled.recycle()

        val input = ByteBuffer.allocateDirect(SIZE * SIZE * 3).order(ByteOrder.nativeOrder())
        var i = 0
        for (pixel in pixels) {
            input.put(((pixel shr 16) and 0xFF).toByte())
            input.put(((pixel shr 8) and 0xFF).toByte())
            input.put((pixel and 0xFF).toByte())
            i++
        }
        input.rewind()

        val output = ByteBuffer.allocateDirect(CLASSES).order(ByteOrder.nativeOrder())
        net.run(input, output)
        output.position(0)
        val raw = ByteArray(CLASSES)
        output.get(raw)

        val signed = runCatching { net.getOutputTensor(0).dataType() == DataType.INT8 }.getOrDefault(false)
        val scores = DoubleArray(CLASSES)
        var best = 0
        for (idx in 0 until CLASSES) {
            val value = if (signed) raw[idx].toInt() else (raw[idx].toInt() and 0xFF)
            scores[idx] = value.toDouble()
            if (value > scores[best].toInt()) best = idx
        }
        val max = scores.max()
        if (max <= 0) return emptyList()

        // Top three classes, mapped to music flavoured tags.
        val order = scores.indices.sortedByDescending { scores[it] }.take(6)
        val picked = LinkedHashMap<String, Float>()
        for (idx in order) {
            val name = names.getOrNull(idx) ?: continue
            val score = (scores[idx] / max).toFloat()
            if (score < 0.08f) continue
            val vibe = VIBE_RULES.firstOrNull { name.contains(it.first, ignoreCase = true) }?.second
                ?: name.split(' ').joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
            picked.putIfAbsent(vibe, score)
            if (picked.size >= 3) break
        }
        return picked.entries.map { (label, score) -> Vibe(label, score) }
    }

    /** True when the model is present in the APK. */
    fun available(context: Context): Boolean = runCatching {
        context.assets.open("efficientnet_lite0.tflite").close()
        true
    }.getOrDefault(false)
}
