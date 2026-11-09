package app.chordless.music.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import androidx.core.content.FileProvider
import app.chordless.music.data.Track
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import java.io.File
import java.io.FileOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Share Now Playing card — 1080×1080 PNG with cover, title/artist,
 * lyric line, progress bar and "SHARED FROM CHORDLESS" footer (desktop parity).
 */
object ShareCard {

    suspend fun create(context: Context, track: Track, positionMs: Long, durationMs: Long, lyricLine: String): File =
        withContext(Dispatchers.IO) {
            val size = 1080
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            // background: deep dark with accent-tinted gradient
            val bg = android.graphics.LinearGradient(
                0f, 0f, size.toFloat(), size.toFloat(),
                intArrayOf(0xFF14141C.toInt(), 0xFF2A0E14.toInt(), 0xFF0B0B0E.toInt()),
                floatArrayOf(0f, 0.55f, 1f),
                android.graphics.Shader.TileMode.CLAMP,
            )
            canvas.drawRect(0f, 0f, size.toFloat(), size.toFloat(), Paint().apply { shader = bg })

            // cover
            val coverBitmap = loadCover(context, track.thumbnail, 720)
            val cx = (size - 720) / 2f
            val cy = 120f
            if (coverBitmap != null) {
                val paint = Paint().apply { isAntiAlias = true }
                canvas.drawBitmap(coverBitmap, cx, cy, paint)
                // rounded corners via clip
                canvas.save()
                canvas.clipPath(android.graphics.Path().apply {
                    addRoundRect(RectF(cx, cy, cx + 720f, cy + 720f), 48f, 48f, android.graphics.Path.Direction.CW)
                })
                canvas.drawBitmap(coverBitmap, cx, cy, paint)
                canvas.restore()
            }

            // texts
            val titlePaint = Paint().apply { color = Color.WHITE; textSize = 56f; typeface = android.graphics.Typeface.DEFAULT_BOLD; isAntiAlias = true }
            val subPaint = Paint().apply { color = 0xFFA6A6AE.toInt(); textSize = 40f; isAntiAlias = true }
            val lyricPaint = Paint().apply { color = 0xFFFF8A90.toInt(); textSize = 38f; isAntiAlias = true }
            val footerPaint = Paint().apply { color = 0xFF8E8E96.toInt(); textSize = 30f; isAntiAlias = true }

            canvas.drawText(ellipsize(track.title.ifBlank { "Unknown" }, titlePaint, 940f), 70f, 940f, titlePaint)
            canvas.drawText(ellipsize(track.artist.ifBlank { "Unknown artist" }, subPaint, 940f), 70f, 998f, subPaint)
            if (lyricLine.isNotBlank()) {
                canvas.drawText(ellipsize(lyricLine, lyricPaint, 940f), 70f, 864f, lyricPaint)
            }

            // progress bar
            val progress = if (durationMs > 0) (positionMs.toFloat() / durationMs).coerceIn(0f, 1f) else 0f
            val trackPaint = Paint().apply { color = 0x33FFFFFF; isAntiAlias = true }
            val fillPaint = Paint().apply { color = 0xFFFC3C44.toInt(); isAntiAlias = true }
            canvas.drawRoundRect(RectF(70f, 1030f, 1010f, 1042f), 6f, 6f, trackPaint)
            canvas.drawRoundRect(RectF(70f, 1030f, 70f + 940f * progress, 1042f), 6f, 6f, fillPaint)

            canvas.drawText("SHARED FROM CHORDLESS", 70f, 1078f, footerPaint)

            // save
            val file = File(context.cacheDir, "share_card.png")
            FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, out) }
            file
        }

    fun shareIntent(context: Context, file: File): Intent {
        val uri: Uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        return Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun ellipsize(text: String, paint: Paint, maxWidth: Float): String {
        var out = text
        while (paint.measureText(out) > maxWidth && out.length > 4) {
            out = out.dropLast(1)
        }
        return if (out == text) out else out.dropLast(1) + "…"
    }

    private suspend fun loadCover(context: Context, url: String, size: Int): Bitmap? {
        if (url.isBlank()) return null
        val loader = ImageLoader(context)
        val request = ImageRequest.Builder(context).data(url).size(size).allowHardware(false).build()
        val result = loader.execute(request)
        return (result as? SuccessResult)?.drawable?.let { drawable ->
            val b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(b)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            b
        }
    }
}
