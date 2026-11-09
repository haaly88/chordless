package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/** SponsorBlock skip segments — direct API, no key. */
object SponsorBlockRepo {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    suspend fun segments(videoId: String): List<Pair<Long, Long>> = withContext(Dispatchers.IO) {
        val url = "https://sponsor.ajay.app/api/skipSegments?videoID=$videoId&categories=sponsor,selfpromo,interaction,intro,outro,music_offtopic"
        val req = Request.Builder().url(url).header("User-Agent", "Chordless Android").build()
        client.newCall(req).execute().use { res ->
            if (res.code == 404) return@withContext emptyList()
            if (!res.isSuccessful) return@withContext emptyList()
            val arr = JSONArray(res.body?.string().orEmpty())
            val out = mutableListOf<Pair<Long, Long>>()
            for (i in 0 until arr.length()) {
                val seg = arr.optJSONArray(i)?.optJSONArray(1) ?: continue
                out.add(seg.optLong(0) to seg.optLong(1))
            }
            out
        }
    }
}
