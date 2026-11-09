package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import java.util.concurrent.TimeUnit

/**
 * Resolves a YouTube videoId to a direct audio URL via NewPipeExtractor.
 * BitChord-style: real stream URLs, no IFrame, no yt-dlp.
 */
object Streams {

    private val mutex = Mutex()
    private val cache = mutableMapOf<String, String>()
    private var init = false

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private object OkDownloader : Downloader() {
        override fun execute(request: Request): Response {
            val builder = Request.Builder()
                .url(request.url())
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
            request.headers().forEach { (name, values) -> values.forEach { builder.header(name, it) } }
            if (request.method() == "POST") {
                builder.post((request.dataToSend() ?: ByteArray(0)).toRequestBody())
            }
            val response = http.newCall(builder.build()).execute()
            return response.use { res ->
                val body = res.body?.bytes() ?: ByteArray(0)
                val headers = mutableMapOf<String, List<String>>()
                res.headers.forEach { (name, value) -> headers[name] = listOf(value) }
                Response(
                    res.code,
                    res.message,
                    headers,
                    body,
                    request.url(),
                )
            }
        }
    }

    private suspend fun ensureInit() = mutex.withLock {
        if (!init) {
            NewPipe.init(OkDownloader)
            init = true
        }
    }

    /** Best (highest-bitrate) audio-only stream URL. */
    suspend fun audioUrl(videoId: String): String = withContext(Dispatchers.IO) {
        ensureInit()
        mutex.withLock { cache[videoId]?.let { return@withContext it } }
        val info = StreamInfo.getInfo("https://www.youtube.com/watch?v=$videoId")
        val streams: List<AudioStream> = info.audioStreams ?: emptyList()
        if (streams.isEmpty()) throw IllegalStateException("No audio streams for $videoId")
        val url = streams.maxByOrNull { it.averageBitrate }?.url
            ?: throw IllegalStateException("No audio stream URL for $videoId")
        mutex.withLock { cache[videoId] = url }
        url
    }
}
