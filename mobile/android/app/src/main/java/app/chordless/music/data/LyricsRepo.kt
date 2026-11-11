package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Synced & plain lyrics.
 *
 * LRCLIB is the primary source; when it has nothing (or nothing synced) we
 * fall back to lrc.red, whose catalogue is ISRC-keyed and often better
 * synchronised.
 */
object LyricsRepo {

    private const val LRC_RED = "https://lrc.red"
    private const val USER_AGENT = "Chordless Android"

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    data class Lyrics(val synced: String = "", val plain: String = "")

    suspend fun get(artist: String, track: String, album: String?, durationSec: Int?): Lyrics =
        withContext(Dispatchers.IO) {
            val lrclib = fromLrclib(artist, track, album, durationSec)
            if (lrclib.synced.isNotBlank()) return@withContext lrclib
            val red = fromLrcRed(artist, track, durationSec)
            if (red.synced.isNotBlank()) return@withContext red
            lrclib
        }

    private fun fromLrclib(
        artist: String,
        track: String,
        album: String?,
        durationSec: Int?,
    ): Lyrics {
        return try {
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
            Request.Builder().url(url).header("User-Agent", USER_AGENT).build().let { req ->
                client.newCall(req).execute().use { res ->
                    val body = res.body?.string().orEmpty()
                    if (!res.isSuccessful) return Lyrics()
                    val json = JSONObject(body)
                    Lyrics(
                        synced = json.optString("syncedLyrics"),
                        plain = json.optString("plainLyrics"),
                    )
                }
            }
        } catch (e: Exception) {
            Lyrics()
        }
    }

    /** lrc.red fallback — ISRC keyed, often better synced than LRCLIB. */
    private fun fromLrcRed(artist: String, track: String, durationSec: Int?): Lyrics {
        return try {
            val q = java.net.URLEncoder.encode("${artist} $track".trim(), "UTF-8")
            val request = Request.Builder()
                .url("$LRC_RED/search.json?q=$q")
                .header("User-Agent", USER_AGENT)
                .build()

            var best: JSONObject? = null
            var bestScore = Double.MAX_VALUE
            val target = (durationSec ?: 0).toDouble()
            val wantTrack = track.trim().lowercase()
            val wantArtist = artist.trim().lowercase()

            client.newCall(request).execute().use { res ->
                if (!res.isSuccessful) return Lyrics()
                val data = JSONObject(res.body?.string().orEmpty())
                val arr = data.optJSONArray("hits") ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val hit = arr.optJSONObject(i) ?: continue
                    val title = hit.optString("title").lowercase()
                    val hitArtist = hit.optString("artist").lowercase()
                    var score = 0.0
                    if (wantTrack.isNotEmpty() && title.isNotEmpty()) {
                        score += if (title.contains(wantTrack) || wantTrack.contains(title)) -1000.0 else 0.0
                    }
                    if (wantArtist.isNotEmpty() && hitArtist.isNotEmpty() && hitArtist.contains(wantArtist)) score -= 300.0
                    val dur = hit.optDouble("duration", 0.0)
                    if (target > 0 && dur > 0) score += kotlin.math.abs(dur - target) * 10
                    if (score < bestScore) {
                        bestScore = score
                        best = hit
                    }
                }
            }

            val hit = best ?: return Lyrics()
            val isrc = hit.optString("isrc").takeIf { it.isNotBlank() } ?: return Lyrics()
            val lrcRequest = Request.Builder()
                .url("$LRC_RED/s/${java.net.URLEncoder.encode(isrc, "UTF-8")}.lrc")
                .header("User-Agent", USER_AGENT)
                .build()
            val synced = client.newCall(lrcRequest).execute().use { res ->
                if (res.isSuccessful) res.body?.string()?.trim().orEmpty() else ""
            }
            Lyrics(synced = synced)
        } catch (e: Exception) {
            Lyrics()
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
