package app.chordless.music.download

import android.app.Service
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import okhttp3.OkHttpClient
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.*
import kotlin.random.Random

/** Service yang berjalan untuk mengelola download track */
@RequiresApi(api = Build.VERSION_CODES.N)
class DownloadService : Service() {

    private var downloadJob: Job? = null
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    /** Start download untuk track tertentu */
    fun startDownload(trackId: String, title: String, artist: String, ctx: Context) {
        val intent = Intent(ctx,::class.java).setAction("app.chordless.music.download.ACTION_START")
        intent.putExtra("track_id", trackId)
        intent.putExtra("title", title)
        intent.putExtra("artist", artist)
        ctx.startService(intent)
    }

    /** Pause download */
    fun pauseDownload(downloadId: String) {
        val intent = Intent(this, ::class.java).setAction("app.chordless.music.download.ACTION_PAUSE")
        intent.putExtra("download_id", downloadId)
        sendBroadcast(intent)
    }

    /** Cancel download */
    fun cancelDownload(downloadId: String) {
        val intent = Intent(this, ::class.java).setAction("app.chordless.music.download.ACTION_CANCEL")
        intent.putExtra("download_id", downloadId)
        sendBroadcast(intent)
    }

    override fun onStartCommand(intent: Intent, flags: Int, startId: Int): Int {
        val action = intent.action
        when (action) {
            "app.chordless.music.download.ACTION_START" -> {
                val trackId = intent.getStringExtra("track_id")
                val title = intent.getStringExtra("title")
                val artist = intent.getStringExtra("artist")
                launchDownload(trackId, title, artist)
            }
        }
        return START_STICKY
    }

    private fun launchDownload(trackId: String, title: String, artist: String) {
        downloadJob = lifecycleScope.launch {
            try {
                // 1. dapatkan stream URL
                val url = Innertube.getStream(trackId)
                if (url == null) throw Exception("No stream URL available")

                // 2. tentukan path file
                val dir = externalFilesDir(null) ?: filesDir
                val file = File(dir, "$title - $artist.${url.extensionOf(MimeTypeMap.getSingleton().getMimeTypeFromExtension("m4a"))}")

                // 3. mulai download
                val request = Request.Builder().url(url).build()
                val response = client.newCall(request).execute { rawResponse ->
                    if (!rawResponse.isSuccessful) throw Exception("HTTP ${rawResponse.code}")
                    rawResponse
                }

                totalBytes = response.body?.contentLength() ?: 0
                downloadedBytes = 0L

                // 4. tulis ke file
                val outputStream = FileOutputStream(file)
                val inputStream = response.byteStream()
                val buffer = ByteArray(8192)
                var bytesRead: Long

                while (isRunning && (bytesRead = inputStream.read(buffer)).also { downloadedBytes += it } != -1) {
                    if (isCanceled) break
                    outputStream.write(buffer, 0, bytesRead)
                    // Notify progress
                    val progress = downloadedBytes.toFloat() / totalBytes.toFloat()
                    publishProgress(progress)
                }

                outputStream.close()
                inputStream.close()

                // 5. selesai
                status = DownloadStatus.COMPLETED
                completedAt = System.currentTimeMillis()
                filePath = file.absolutePath
                publishProgress(1f)
                onDownloadCompleted(file.absolutePath)

            } catch (e: Exception) {
                Log.e("DownloadService", "Download error", e)
                status = DownloadStatus.FAILED
                error = e.message ?: "Unknown error"
                publishProgress(0f)
                onDownloadFailed(error!!)
            } finally {
                downloadJob = null
            }
        }
    }

    // Status tracking
    private var status: DownloadStatus = DownloadStatus.PENDING
    private var isCanceled = false
    private var totalBytes: Long = 0L
    private var downloadedBytes: Long = 0L
    private var error: String? = null

    /** Progress callback - dipanggil dari UI */
    private var progressCallback: ((Float, Long, Long) -> Unit)? = null
    private var completedCallback: (() -> Unit)? = null
    private var failedCallback: ((String) -> Unit)? = null

    fun setProgressCallback(callback: (Float, Long, Long) -> Unit) {
        progressCallback = callback
    }

    fun setCompletedCallback(callback: () -> Unit) {
        completedCallback = callback
    }

    fun setFailedCallback(callback: (String) -> Unit) {
        failedCallback = callback
    }

    private fun publishProgress(progress: Float) {
        downloadedBytesProgress = (progress * totalBytes).coerceAtLeast(0L)
        progressCallback?.invoke(progress, downloadedBytesProgress, totalBytes)
    }

    fun onDownloadCompleted(path: String?) {
        completedCallback?.invoke()
        // Mark as completed in database
    }

    fun onDownloadFailed(error: String) {
        failedCallback?.invoke(error)
    }
}

/** Status download */
enum class DownloadStatus { PENDING, DOWNLOADING, COMPLETED, FAILED, CANCELED }

/* Note: isRunning and isCanceled are referenced but not defined in this snippet -
   they should be added as private var properties in the actual class */