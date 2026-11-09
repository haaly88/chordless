package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Synced & plain lyrics via LRCLIB (no key, CORS not applicable on-device). */
object LyricsRepo {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    data class Lyrics(val synced: String = "", val plain: String = "")

    suspend fun get(artist: String, track: String, album: String?, durationSec: Int?): Lyrics =
        withContext(Dispatchers.IO) {
            val url = buildString {
                append("https://lrclib.net/api/get?artist_name=")
                append(java.net.URLEncoder.encode(artist, "UTF-8"))
                append("&track_name=")
                append(java.net.URLEncoder.encode(track, "UTF-8"))
                if (!album.isNullOrBlank()) {
                    append("&album_name=")
                    append(java.net.URLEncoder.encode(album, "UTF-8"))
                }
                if (durationSec != null && durationSec > 0) append("&duration=").append(durationSec)
            }
            Request.Builder().url(url).header("User-Agent", "Chordless Android").build().let { req ->
                client.newCall(req).execute().use { res ->
                    val body = res.body?.string().orEmpty()
                    if (!res.isSuccessful) return@withContext Lyrics()
                    val json = JSONObject(body)
                    Lyrics(
                        synced = json.optString("syncedLyrics"),
                        plain = json.optString("plainLyrics"),
                    )
                }
            }
        }

    /** Parse "[mm:ss.xx] text" lines into (timeMs, text). */
    fun parseLrc(lrc: String): List<Pair<Long, String>> {
        val re = Regex("""\[(\d+):(\d+)(?:[.:](\d{1,3}))?]\s*(.*)""")
        return lrc.lines().mapNotNull { line ->
            val m = re.find(line) ?: return@mapNotNull null
            val mm = m.groupValues[1].toLong()
            val ss = m.groupValues[2].toLong()
            val cs = m.groupValues[3].toLongOrNull() ?: 0
            (mm * 60 + ss) * 1000 + cs * when (m.groupValues[3].length) {
                2 -> 10
                3 -> 1
                else -> 100
            } to m.groupValues[4]
        }
    }

    fun fmtClock(ms: Long): String {
        val s = (ms / 1000).toInt()
        return "%d:%02d".format(s / 60, s % 60)
    }
}
