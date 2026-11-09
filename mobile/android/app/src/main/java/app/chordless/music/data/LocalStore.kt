package app.chordless.music.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import app.chordless.music.data.Track
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

private val Context.store by preferencesDataStore(name = "chordless-store")

private val K_PLAYLISTS = stringPreferencesKey("playlists")
private val K_FAVS = stringPreferencesKey("favorites")
private val K_HISTORY = stringPreferencesKey("history")
private val K_SEARCH = stringSetPreferencesKey("searchHistory")

/** Local playlists / favorites / history / search-history (JSON in DataStore). */
object LocalStore {

    // ---------- track <-> json ----------
    fun trackToJson(t: Track): JSONObject = JSONObject()
        .put("id", t.id).put("title", t.title).put("artist", t.artist)
        .put("album", t.album ?: "").put("kind", t.kind)
        .put("duration", t.duration).put("thumbnail", t.thumbnail)
        .put("browseId", t.browseId ?: "")

    fun trackFromJson(o: JSONObject): Track = Track(
        id = o.optString("id"),
        title = o.optString("title"),
        artist = o.optString("artist"),
        album = o.optString("album").ifBlank { null },
        kind = o.optString("kind", "track"),
        duration = o.optLong("duration"),
        thumbnail = o.optString("thumbnail"),
        browseId = o.optString("browseId").ifBlank { null },
    )

    private fun tracksToJson(list: List<Track>): String {
        val arr = JSONArray()
        list.forEach { arr.put(trackToJson(it)) }
        return arr.toString()
    }

    private fun tracksFromJsonSafe(s: String?): List<Track> {
        if (s.isNullOrBlank()) return emptyList()
        return try {
            val arr = JSONArray(s)
            val out = mutableListOf<Track>()
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                out.add(trackFromJson(o))
            }
            out
        } catch (e: Exception) {
            emptyList()
        }
    }

    // ---------- favorites ----------
    suspend fun favorites(ctx: Context): List<Track> =
        ctx.store.data.map { tracksFromJsonSafe(it[K_FAVS]) }.first()

    suspend fun setFavorite(ctx: Context, track: Track, fav: Boolean) {
        val cur = favorites(ctx).toMutableList()
        if (fav) {
            if (cur.none { it.id == track.id }) cur.add(0, track)
        } else {
            cur.removeAll { it.id == track.id }
        }
        ctx.store.edit { it[K_FAVS] = tracksToJson(cur) }
    }

    suspend fun isFavorite(ctx: Context, id: String): Boolean =
        favorites(ctx).any { it.id == id }

    // ---------- playlists ----------
    data class Playlist(val id: String, val name: String, val tracks: List<Track>)

    private fun playlistsToJson(list: List<Playlist>): String {
        val arr = JSONArray()
        list.forEach { p ->
            arr.put(JSONObject().put("id", p.id).put("name", p.name).put("tracks", JSONArray(tracksToJson(p.tracks))))
        }
        return arr.toString()
    }

    private fun playlistsFromJson(s: String?): List<Playlist> {
        if (s.isNullOrBlank()) return emptyList()
        return try {
            val arr = JSONArray(s)
            val out = mutableListOf<Playlist>()
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val tr = o.optJSONArray("tracks")
                val list = mutableListOf<Track>()
                if (tr != null) for (j in 0 until tr.length()) {
                    val to = tr.optJSONObject(j) ?: continue
                    list.add(trackFromJson(to))
                }
                out.add(Playlist(o.optString("id"), o.optString("name"), list))
            }
            out
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun playlists(ctx: Context): List<Playlist> =
        ctx.store.data.map { playlistsFromJson(it[K_PLAYLISTS]) }.first()

    suspend fun createPlaylist(ctx: Context, name: String): Playlist {
        val p = Playlist(UUID.randomUUID().toString(), name, emptyList())
        val cur = playlists(ctx).toMutableList()
        cur.add(p)
        ctx.store.edit { it[K_PLAYLISTS] = playlistsToJson(cur) }
        return p
    }

    suspend fun renamePlaylist(ctx: Context, id: String, name: String) {
        val cur = playlists(ctx).map { if (it.id == id) it.copy(name = name) else it }
        ctx.store.edit { it[K_PLAYLISTS] = playlistsToJson(cur) }
    }

    suspend fun deletePlaylist(ctx: Context, id: String) {
        val cur = playlists(ctx).filterNot { it.id == id }
        ctx.store.edit { it[K_PLAYLISTS] = playlistsToJson(cur) }
    }

    suspend fun addToPlaylist(ctx: Context, playlistId: String, track: Track) {
        val cur = playlists(ctx).map {
            if (it.id == playlistId) {
                if (it.tracks.any { t -> t.id == track.id }) it else it.copy(tracks = it.tracks + track)
            } else it
        }
        ctx.store.edit { it[K_PLAYLISTS] = playlistsToJson(cur) }
    }

    suspend fun removeFromPlaylist(ctx: Context, playlistId: String, trackId: String) {
        val cur = playlists(ctx).map {
            if (it.id == playlistId) it.copy(tracks = it.tracks.filterNot { t -> t.id == trackId }) else it
        }
        ctx.store.edit { it[K_PLAYLISTS] = playlistsToJson(cur) }
    }

    /** Auto-collage cover from up to 9 track thumbnails (first non-blank). */
    fun collageUrl(p: Playlist): String =
        p.tracks.map { it.thumbnail }.firstOrNull { it.isNotBlank() } ?: ""

    // ---------- history (for smart playlists & stats) ----------
    data class HistoryEntry(val count: Int, val lastPlayed: Long, val track: Track)

    private fun historyToJson(map: Map<String, HistoryEntry>): String {
        val o = JSONObject()
        map.forEach { (id, e) ->
            o.put(id, JSONObject().put("count", e.count).put("last", e.lastPlayed).put("track", trackToJson(e.track)))
        }
        return o.toString()
    }

    private fun historyFromJson(s: String?): Map<String, HistoryEntry> {
        if (s.isNullOrBlank()) return emptyMap()
        return try {
            val o = JSONObject(s)
            val out = mutableMapOf<String, HistoryEntry>()
            val keys = o.keys()
            while (keys.hasNext()) {
                val id = keys.next()
                val e = o.optJSONObject(id) ?: continue
                out[id] = HistoryEntry(
                    count = e.optInt("count", 1),
                    lastPlayed = e.optLong("last"),
                    track = trackFromJson(e.optJSONObject("track") ?: continue),
                )
            }
            out
        } catch (e: Exception) {
            emptyMap()
        }
    }

    suspend fun history(ctx: Context): Map<String, HistoryEntry> =
        ctx.store.data.map { historyFromJson(it[K_HISTORY]) }.first()

    suspend fun recordPlay(ctx: Context, track: Track) {
        val cur = history(ctx).toMutableMap()
        val old = cur[track.id]
        cur[track.id] = HistoryEntry(
            count = (old?.count ?: 0) + 1,
            lastPlayed = System.currentTimeMillis(),
            track = track,
        )
        // keep at most 500 entries (LRU by lastPlayed)
        val trimmed = if (cur.size > 500) {
            cur.entries.sortedByDescending { it.value.lastPlayed }.take(500).associate { it.key to it.value }
        } else cur
        ctx.store.edit { it[K_HISTORY] = historyToJson(trimmed) }
    }

    // ---------- search history ----------
    suspend fun searchHistory(ctx: Context): List<String> =
        ctx.store.data.map { (it[K_SEARCH] ?: emptySet()).toList() }.first()

    suspend fun pushSearch(ctx: Context, q: String) {
        val query = q.trim()
        if (query.isEmpty()) return
        val cur = (searchHistory(ctx) + query).distinct().takeLast(12)
        ctx.store.edit { it[K_SEARCH] = cur.toSet() }
    }

    suspend fun removeSearch(ctx: Context, q: String) {
        val cur = searchHistory(ctx).filterNot { it == q }
        ctx.store.edit { it[K_SEARCH] = cur.toSet() }
    }

    suspend fun clearSearch(ctx: Context) {
        ctx.store.edit { it[K_SEARCH] = emptySet() }
    }
}
