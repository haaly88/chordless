package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Update notifier — mirrors the web updateCheck.js (GitHub Releases latest). */
object UpdateRepo {

    const val CURRENT_VERSION = "1.1.0"
    private const val LATEST_URL = "https://api.github.com/repos/haaly88/chordless/releases/latest"
    private const val RELEASES_URL = "https://github.com/haaly88/chordless/releases"

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    data class Update(val version: String, val url: String)

    fun compareVersions(a: String, b: String): Int {
        val pa = a.removePrefix("v").split(".").map { it.toIntOrNull() ?: 0 }
        val pb = b.removePrefix("v").split(".").map { it.toIntOrNull() ?: 0 }
        val len = maxOf(pa.size, pb.size)
        for (i in 0 until len) {
            val diff = (pa.getOrNull(i) ?: 0) - (pb.getOrNull(i) ?: 0)
            if (diff != 0) return diff
        }
        return 0
    }

    /** Returns an Update if a newer release exists, else null. Silent on failure. */
    suspend fun check(): Update? = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder()
                .url(LATEST_URL)
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Chordless Android")
                .build()
            client.newCall(req).execute().use { res ->
                if (!res.isSuccessful) return@withContext null
                val json = JSONObject(res.body?.string().orEmpty())
                val tag = json.optString("tag_name").removePrefix("v")
                if (tag.isBlank()) return@withContext null
                if (compareVersions(tag, CURRENT_VERSION) <= 0) return@withContext null
                Update(tag, json.optString("html_url").ifBlank { RELEASES_URL })
            }
        } catch (e: Exception) {
            null
        }
    }
}
