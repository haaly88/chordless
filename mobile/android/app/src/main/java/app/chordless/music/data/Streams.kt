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
import org.schabi.newpipe.extractor.stream.AudioStream
import org.schabi.newpipe.extractor.stream.StreamInfo
import java.util.concurrent.TimeUnit

/**
 * Resolves a YouTube videoId to a direct audio URL via NewPipeExtractor.
 * BitChord-style: real stream URLs, no IFrame, no yt-dlp.
 */
object Streams {

    data class Resolved(val url: String, val mime: String = "", val bitrate: Int = 0)

    private val mutex = Mutex()
    // videoId -> (resolved, resolvedAtMs). Stream URLs expire server-side,
    // so cached entries are treated as stale after ~3 hours.
    private val cache = mutableMapOf<String, Pair<Resolved, Long>>()
    private var init = false

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private object OkDownloader : Downloader() {
        override fun execute(request: org.schabi.newpipe.extractor.downloader.Request): org.schabi.newpipe.extractor.downloader.Response {
            val builder = Request.Builder()
                .url(request.url())
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
            request.headers().forEach { (name, values) -> values.forEach { builder.header(name, it) } }
            val data = request.dataToSend()
            if (data != null) {
                builder.post(data.toRequestBody())
            }
            val response = http.newCall(builder.build()).execute()
            return response.use { res ->
                val bodyString = res.body?.string() ?: ""
                val headers = mutableMapOf<String, List<String>>()
                res.headers.forEach { (name, value) -> headers[name] = listOf(value) }
                org.schabi.newpipe.extractor.downloader.Response(
                    res.code,
                    res.message,
                    headers,
                    bodyString,
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

    /** Best (highest-bitrate) audio-only stream. */
    suspend fun resolve(videoId: String): Resolved = withContext(Dispatchers.IO) {
        ensureInit()
        mutex.withLock {
            cache[videoId]?.let { (resolved, at) ->
                if (System.currentTimeMillis() - at < 3 * 3_600_000L) return@withContext resolved
            }
        }
        val info = runCatching { StreamInfo.getInfo("https://www.youtube.com/watch?v=$videoId") }
            .getOrElse {
                // transient extractor hiccup — one retry before giving up
                kotlinx.coroutines.delay(600)
                StreamInfo.getInfo("https://www.youtube.com/watch?v=$videoId")
            }
        val streams: List<AudioStream> = info.audioStreams ?: emptyList()
        if (streams.isEmpty()) throw IllegalStateException("No audio streams for $videoId")
        val best = streams.maxByOrNull { it.averageBitrate } ?: streams.first()
        val url = best.url ?: throw IllegalStateException("No stream URL for $videoId")
        val resolved = Resolved(
            url = url,
            mime = best.format?.mimeType ?: "",
            bitrate = best.averageBitrate,
        )
        mutex.withLock { cache[videoId] = resolved to System.currentTimeMillis() }
        resolved
    }

    /** Backwards-compatible URL-only helper. */
    suspend fun audioUrl(videoId: String): String = resolve(videoId).url
}
