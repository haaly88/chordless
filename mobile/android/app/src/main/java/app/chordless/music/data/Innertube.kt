package app.chordless.music.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Native InnerTube (WEB_REMIX) client — the same protocol the web app's
 * server uses, but executed on-device so no backend is required.
 */
object Innertube {

    private const val BASE = "https://music.youtube.com/youtubei/v1"
    private const val CLIENT_NAME = "WEB_REMIX"
    private const val CLIENT_VERSION = "1.20251112.01.00"

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun post(endpoint: String, body: JSONObject, gl: String = "ID", hl: String = "en"): JSONObject =
        withContext(Dispatchers.IO) {
            val payload = JSONObject()
                .put("context", JSONObject().put("client", JSONObject()
                    .put("clientName", CLIENT_NAME)
                    .put("clientVersion", CLIENT_VERSION)
                    .put("hl", hl)
                    .put("gl", gl)))
            body.keys().forEach { payload.put(it, body.get(it)) }

            val request = Request.Builder()
                .url("$BASE/$endpoint")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
                .header("Origin", "https://music.youtube.com")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", CLIENT_VERSION)
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()
            client.newCall(request).execute().use { res ->
                val text = res.body?.string().orEmpty()
                if (!res.isSuccessful) throw IllegalStateException("InnerTube $endpoint failed: HTTP ${res.code}")
                JSONObject(text)
            }
        }

    suspend fun search(query: String, limit: Int = 30, gl: String = "ID", hl: String = "en"): List<Track> =
        Parser.search(post("search", JSONObject().put("query", query), gl, hl), limit)

    suspend fun homeShelves(gl: String = "ID", hl: String = "en"): Pair<List<Shelf>, List<PlaylistCard>> {
        return try {
            Parser.homeShelves(post("browse", JSONObject().put("browseId", "FEmusic_home"), gl, hl))
        } catch (e: Exception) {
            val shelves = mutableListOf<Shelf>()
            for ((title, q) in listOf("Trending songs" to "top hits", "Viral right now" to "viral hits")) {
                try {
                    val items = search(q, 12, gl, hl)
                    if (items.size >= 4) shelves.add(Shelf(title, items))
                } catch (_: Exception) { }
            }
            shelves to emptyList()
        }
    }

    suspend fun charts(gl: String = "ID", hl: String = "en"): List<Shelf> {
        val queries = Parser.chartQueries(hl)
        val titles = listOf("Trending Now", "Viral Hits", "Top Charts", "New Releases")
        val shelves = mutableListOf<Shelf>()
        for (i in titles.indices) {
            try {
                val items = search(queries[i], 12, gl, hl)
                if (items.isNotEmpty()) shelves.add(Shelf(titles[i], items))
            } catch (_: Exception) { }
        }
        return shelves
    }

    suspend fun artist(id: String, gl: String = "ID", hl: String = "en"): PageInfo =
        Parser.browsePage(post("browse", JSONObject().put("browseId", id), gl, hl), "artist", id)

    suspend fun album(id: String, gl: String = "ID", hl: String = "en"): PageInfo =
        Parser.browsePage(post("browse", JSONObject().put("browseId", id), gl, hl), "album", id)

    suspend fun playlist(id: String, gl: String = "ID", hl: String = "en"): PageInfo {
        val clean = id.removePrefix("VL")
        require(clean.matches(Regex("^[A-Za-z0-9_-]{8,64}$"))) { "bad playlist id" }
        return Parser.playlistPage(post("browse", JSONObject().put("browseId", "VL$clean"), gl, hl), clean)
    }
}
