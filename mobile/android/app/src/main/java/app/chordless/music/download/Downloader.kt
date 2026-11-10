package app.chordless.music.download

import android.content.Context
import app.chordless.music.data.Streams
import app.chordless.music.data.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

/**
 * Offline downloads.
 *
 * Resolves the audio stream through the same NewPipe pipeline the player uses,
 * then writes it to the app-private `downloads` folder. Progress is exposed as
 * a [StateFlow] so the UI can surface it.
 */
object Downloader {

    enum class Status { PENDING, DOWNLOADING, COMPLETED, FAILED }

    data class State(
        val trackId: String,
        val status: Status,
        val progress: Float = 0f,
        val file: File? = null,
        val error: String? = null,
    )

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build()

    private val _states = MutableStateFlow<Map<String, State>>(emptyMap())
    val states = _states.asStateFlow()

    fun stateOf(trackId: String): State? = _states.value[trackId]

    /** Download [track]; returns the resulting state. */
    suspend fun download(context: Context, track: Track): State = withContext(Dispatchers.IO) {
        publish(track.id, State(track.id, Status.PENDING))
        try {
            val resolved = Streams.resolve(track.id)
            val dir = File(context.filesDir, "downloads").apply { mkdirs() }
            val file = File(dir, fileName(track, resolved.mime))

            val request = Request.Builder().url(resolved.url)
                .header("User-Agent", "Chordless Android")
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IllegalStateException("HTTP ${response.code}")
                val body = response.body ?: throw IllegalStateException("Empty response")
                val total = body.contentLength()
                val output = FileOutputStream(file)
                val input = body.byteStream()
                val buffer = ByteArray(64 * 1024)
                var written = 0L
                try {
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        written += read
                        val fraction = if (total > 0) (written.toFloat() / total).coerceIn(0f, 1f) else 0f
                        publish(track.id, State(track.id, Status.DOWNLOADING, fraction, file))
                    }
                } finally {
                    runCatching { output.close() }
                    runCatching { input.close() }
                }
            }

            val done = State(track.id, Status.COMPLETED, 1f, file)
            writeMeta(file, track)
            publish(track.id, done)
            done
        } catch (e: Exception) {
            val failed = State(track.id, Status.FAILED, error = e.message ?: "Download failed")
            publish(track.id, failed)
            failed
        }
    }

    private fun publish(trackId: String, state: State) {
        _states.value = _states.value.toMutableMap().apply { put(trackId, state) }
    }

    /** Sidecar with the track metadata so the offline library can rebuild it. */
    private fun writeMeta(file: File, track: Track) {
        runCatching {
            File(file.parentFile, file.name + ".meta").writeText(
                listOf(track.id, track.title, track.artist, track.duration.toString())
                    .joinToString("\n")
            )
        }
    }

    /** Metadata for a downloaded file, when available. */
    fun metaFor(file: File): Track? = runCatching {
        val sidecar = File(file.parentFile, file.name + ".meta")
        if (!sidecar.exists()) return null
        val parts = sidecar.readText().split("\n")
        if (parts.size < 4) return null
        Track(
            id = parts[0],
            title = parts[1],
            artist = parts[2],
            duration = parts[3].toLongOrNull() ?: 0L,
            thumbnail = "",
        )
    }.getOrNull()

    /** Removes a downloaded file together with its metadata sidecar. */
    fun delete(file: File) {
        runCatching { File(file.parentFile, file.name + ".meta").delete() }
        runCatching { file.delete() }
    }

    private fun fileName(track: Track, mime: String): String {
        val base = "${track.artist} - ${track.title}".replace(Regex("[^\\p{L}\\p{N}\\-_ ]"), "").trim()
            .replace(Regex("\\s+"), "_")
            .ifBlank { track.id }
        return base.take(80) + "." + extensionFor(mime)
    }

    private fun extensionFor(mime: String): String = when {
        mime.contains("mp4") -> "m4a"
        mime.contains("webm") -> "webm"
        mime.contains("mpeg") -> "mp3"
        mime.contains("ogg") -> "ogg"
        else -> "m4a"
    }
}
