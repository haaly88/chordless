package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Lyrics translation — Google GTX (primary, mirrors desktop) + MyMemory fallback.
 * Native on-device calls (no CORS limitation).
 */
object TranslateRepo {

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun translate(text: String, target: String): String = withContext(Dispatchers.IO) {
        val trimmed = text.trim()
        if (trimmed.isEmpty() || target == "auto") return@withContext text
        // Google GTX — line-preserving (translate line by line, keep blanks)
        try {
            val lines = trimmed.lines()
            val out = lines.map { line ->
                if (line.isBlank()) line else gtx(line, target)
            }
            val joined = out.joinToString("\n")
            if (joined.isNotBlank()) return@withContext joined
        } catch (e: Exception) {
            // fall through
        }
        // MyMemory fallback (whole text)
        try {
            val url = "https://api.mymemory.translated.net/get?q=${URLEncoder.encode(trimmed, "UTF-8")}&langpair=auto|$target"
            val req = Request.Builder().url(url).header("User-Agent", "Chordless Android").build()
            client.newCall(req).execute().use { res ->
                if (res.isSuccessful) {
                    val json = JSONObject(res.body?.string().orEmpty())
                    val translated = json.optJSONObject("responseData")?.optString("translatedText")
                    if (!translated.isNullOrBlank()) return@withContext translated
                }
            }
        } catch (e: Exception) {
            // give up — caller keeps original
        }
        text
    }

    private fun gtx(line: String, target: String): String {
        val url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=$target&dt=t&q=${URLEncoder.encode(line, "UTF-8")}"
        val req = Request.Builder().url(url).header("User-Agent", "Chordless Android").build()
        val response = client.newCall(req).execute()
        val body = response.body?.string().orEmpty()
        val ok = response.isSuccessful
        response.close()
        if (!ok) throw IllegalStateException("gtx failed")
        val arr = org.json.JSONArray(body)
        val first = arr.optJSONArray(0) ?: return line
        val sb = StringBuilder()
        for (i in 0 until first.length()) {
            val seg = first.optJSONArray(i) ?: continue
            sb.append(seg.optString(0))
        }
        return sb.toString().ifBlank { line }
    }
}
