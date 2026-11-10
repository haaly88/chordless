package app.chordless.music.data

import androidx.compose.foundation.lazy.items
import org.json.JSONArray
import org.json.JSONObject

/**
 * InnerTube response parsers — direct port of the web app's
 * server/innertube.js normalization logic (org.json based).
 */
object Parser {

    private fun runsText(runs: JSONArray?): String {
        if (runs == null) return ""
        val sb = StringBuilder()
        for (i in 0 until runs.length()) sb.append(runs.optJSONObject(i)?.optString("text") ?: "")
        return sb.toString()
    }

    private fun upgradeThumb(u: String): String {
        if (u.isEmpty()) return u
        var out = u.replace(Regex("=w\\d{2,4}-h\\d{2,4}(-\\w[\\w-]*)?"), "=w512-h512$1")
        out = out.replace(Regex("=s\\d{2,4}(-\\w[\\w-]*)?"), "=s1200$1")
        return out
    }

    private fun bestThumb(thumbnails: JSONArray?): String {
        if (thumbnails == null || thumbnails.length() == 0) return ""
        return upgradeThumb(thumbnails.optJSONObject(thumbnails.length() - 1)?.optString("url")
            ?: thumbnails.optJSONObject(0)?.optString("url") ?: "")
    }

    private fun findWatchEndpoint(node: Any?): JSONObject? {
        if (node !is JSONObject) return null
        val w = node.optJSONObject("watchEndpoint")
        if (w != null && w.optString("videoId").isNotEmpty()) return w
        val keys = node.keys()
        while (keys.hasNext()) {
            val hit = findWatchEndpoint(node.opt(keys.next()))
            if (hit != null) return hit
        }
        return null
    }

    private fun parseDurationText(text: String?): Long {
        if (text.isNullOrBlank()) return 0
        val m = Regex("(?:(\\d+):)?(\\d{1,2}):(\\d{2})").find(text.trim()) ?: return 0
        val (h, mm, ss) = m.destructured
        return if (h.isNotEmpty()) h.toLong() * 3600 + mm.toLong() * 60 + ss.toLong()
        else mm.toLong() * 60 + ss.toLong()
    }

    private fun classify(subtitle: String): String {
        val s = subtitle.trim()
        return when {
            s.startsWith("Song", ignoreCase = true) -> "song"
            s.startsWith("Video", ignoreCase = true) -> "video"
            s.startsWith("Album", ignoreCase = true) -> "album"
            s.startsWith("Artist", ignoreCase = true) -> "artist"
            s.startsWith("Podcast", ignoreCase = true) -> "podcast"
            else -> "track"
        }
    }

    private val COUNT_RE = Regex("^[\\d.,]+\\s*[KMB]?\\s*(plays|views|listeners|subscribers)$", RegexOption.IGNORE_CASE)
    private val PREFIX_RE = Regex("^(song|video|album|artist|podcast)\\b", RegexOption.IGNORE_CASE)

    private fun artistFromSubtitle(subtitle: String): String {
        val parts = subtitle.split('•').map { it.trim() }.filter { it.isNotEmpty() }
        if (parts.isEmpty()) return ""
        if (PREFIX_RE.containsMatchIn(parts[0])) return if (parts.size >= 2) parts[1] else ""
        if (parts.size >= 2 && COUNT_RE.matches(parts.last())) return parts.dropLast(1).joinToString(" • ")
        return parts[0]
    }

    private fun albumFromExtraColumn(cols: List<String>): String? {
        val raw = cols.getOrNull(2)?.trim().orEmpty()
        if (raw.isEmpty() || COUNT_RE.matches(raw)) return null
        return raw
    }

    private fun parseResponsiveListItem(node: Any?): Track? {
        val r = (node as? JSONObject)?.optJSONObject("musicResponsiveListItemRenderer") ?: return null
        val cols = mutableListOf<String>()
        val flex = r.optJSONArray("flexColumns")
        if (flex != null) for (i in 0 until flex.length()) {
            cols.add(runsText(flex.optJSONObject(i)?.optJSONObject("musicResponsiveListItemFlexColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs")))
        }
        val subtitle = cols.getOrNull(1) ?: ""
        val kind = classify(subtitle)
        if (kind == "podcast") return null

        val videoId = r.optJSONObject("overlay")
            ?.optJSONObject("musicItemThumbnailOverlayRenderer")
            ?.optJSONObject("content")
            ?.optJSONObject("musicPlayButtonRenderer")
            ?.optJSONObject("playNavigationEndpoint")
            ?.optJSONObject("watchEndpoint")?.optString("videoId")?.takeIf { it.isNotEmpty() }
            ?: r.optJSONObject("playlistItemData")?.optString("videoId")?.takeIf { it.isNotEmpty() }
            ?: findWatchEndpoint(r)?.optString("videoId")

        if (videoId.isNullOrEmpty()) {
            if (kind == "artist" || kind == "album") {
                val browseId = r.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                    ?.takeIf { it.isNotEmpty() }
                    ?: r.optJSONObject("title")?.optJSONArray("runs")?.let { runs ->
                        for (i in 0 until runs.length()) {
                            val b = runs.optJSONObject(i)?.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                            if (!b.isNullOrEmpty()) return@let b
                        }
                        null
                    }
                if (!browseId.isNullOrEmpty()) {
                    return Track(
                        id = browseId.replace(Regex("^(MPRE|OLAK5|MP)"), ""),
                        title = cols.getOrNull(0) ?: "Unknown",
                        artist = if (kind == "album") artistFromSubtitle(subtitle) else "",
                        kind = kind,
                        thumbnail = bestThumb(r.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")),
                        browseId = browseId,
                    )
                }
            }
            return null
        }

        val fixed = StringBuilder()
        val fixedCols = r.optJSONArray("fixedColumns")
        if (fixedCols != null) for (i in 0 until fixedCols.length()) {
            fixed.append(runsText(fixedCols.optJSONObject(i)?.optJSONObject("musicResponsiveListItemFixedColumnRenderer")?.optJSONObject("text")?.optJSONArray("runs"))).append(' ')
        }

        return Track(
            id = videoId,
            title = cols.getOrNull(0) ?: "Unknown title",
            artist = artistFromSubtitle(subtitle),
            album = albumFromExtraColumn(cols),
            kind = kind,
            duration = parseDurationText(fixed.toString()),
            thumbnail = bestThumb(r.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")),
        )
    }

    private fun parseCardShelf(card: JSONObject): Track? {
        val r = card.optJSONObject("musicCardShelfRenderer") ?: return null
        val videoId = findWatchEndpoint(r)?.optString("videoId") ?: return null
        val subtitle = runsText(r.optJSONObject("subtitle")?.optJSONArray("runs"))
        val kind = classify(subtitle)
        if (kind == "album" || kind == "artist" || kind == "podcast") return null
        return Track(
            id = videoId,
            title = runsText(r.optJSONObject("title")?.optJSONArray("runs")) ?: "Unknown title",
            artist = artistFromSubtitle(subtitle),
            kind = kind,
            thumbnail = bestThumb(
                r.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                    ?: r.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
            ),
        )
    }

    private fun parseTwoRowItem(node: Any?): PlaylistCard? {
        val r = (node as? JSONObject)?.optJSONObject("musicTwoRowItemRenderer") ?: return null
        val title = runsText(r.optJSONObject("title")?.optJSONArray("runs"))
        if (title.isEmpty()) return null
        val browseId = r.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
            ?: r.optJSONObject("title")?.optJSONArray("runs")?.let { runs ->
                for (i in 0 until runs.length()) {
                    val b = runs.optJSONObject(i)?.optJSONObject("navigationEndpoint")?.optJSONObject("browseEndpoint")?.optString("browseId")
                    if (!b.isNullOrEmpty()) return@let b
                }
                null
            } ?: return null
        val subRuns = r.optJSONObject("subtitle")?.optJSONArray("runs")
        val subtitle = runsText(subRuns)
        var author = ""
        var views = ""
        if (subRuns != null) for (i in 0 until subRuns.length()) {
            val run = subRuns.optJSONObject(i) ?: continue
            if (author.isEmpty() && run.has("navigationEndpoint")) author = run.optString("text")
            if (views.isEmpty() && Regex("views|plays", RegexOption.IGNORE_CASE).containsMatchIn(run.optString("text"))) views = run.optString("text")
        }
        if (author.isEmpty()) author = subtitle.split('•').firstOrNull()?.trim() ?: ""
        return PlaylistCard(
            id = browseId.removePrefix("VL"),
            title = title,
            author = author,
            views = views,
            thumbnail = bestThumb(
                r.optJSONObject("thumbnailRenderer")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                    ?: r.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
            ),
        )
    }

    private fun walk(node: Any?, visit: (JSONObject) -> Unit) {
        if (node is JSONObject) {
            visit(node)
            val keys = node.keys()
            while (keys.hasNext()) walk(node.opt(keys.next()), visit)
        } else if (node is JSONArray) {
            for (i in 0 until node.length()) walk(node.opt(i), visit)
        }
    }

    private fun dedupe(items: List<Track>): List<Track> {
        val seen = HashSet<String>()
        return items.filter { seen.add(it.id) }
    }

    // ---------- search ----------

    fun search(doc: JSONObject, limit: Int): List<Track> {
        val items = mutableListOf<Track>()
        val contents = doc.optJSONObject("contents")
        val tabs = contents?.optJSONObject("tabbedSearchResultsRenderer")?.optJSONArray("tabs")
        if (tabs != null) {
            for (t in 0 until tabs.length()) {
                val sections = tabs.optJSONObject(t)?.optJSONObject("tabRenderer")?.optJSONObject("content")?.optJSONObject("sectionListRenderer")?.optJSONArray("contents") ?: continue
                for (s in 0 until sections.length()) items.addAll(itemsFromSection(sections.optJSONObject(s)))
            }
        } else {
            walk(doc) { node ->
                if (node.has("itemSectionRenderer") || node.has("musicCarouselShelfRenderer") || node.has("musicCardShelfRenderer")) {
                    items.addAll(itemsFromSection(node))
                }
            }
        }
        val ordered = dedupe(items)
        val songs = ordered.filter { it.kind == "song" }
        val videos = ordered.filter { it.kind == "video" }
        val rest = ordered.filter { it.kind != "song" && it.kind != "video" }
        return (songs + videos + rest).take(limit)
    }

    private fun itemsFromSection(section: JSONObject?): List<Track> {
        if (section == null) return emptyList()
        if (section.has("musicCardShelfRenderer")) {
            return listOfNotNull(parseCardShelf(section))
        }
        val inner = section.optJSONObject("itemSectionRenderer") ?: section.optJSONObject("musicCarouselShelfRenderer") ?: return emptyList()
        val out = mutableListOf<Track>()
        val contents = inner.optJSONArray("contents") ?: return emptyList()
        for (i in 0 until contents.length()) parseResponsiveListItem(contents.opt(i))?.let(out::add)
        return out
    }

    // ---------- home / shelves ----------

    fun homeShelves(doc: JSONObject): Pair<List<Shelf>, List<PlaylistCard>> {
        val shelves = mutableListOf<Shelf>()
        val playlists = mutableListOf<PlaylistCard>()
        val seenTitles = HashSet<String>()
        walk(doc) { node ->
            if (node.has("musicCarouselShelfRenderer")) {
                val shelf = node.optJSONObject("musicCarouselShelfRenderer") ?: return@walk
                val title = runsText(shelf.optJSONObject("header")?.optJSONObject("musicCarouselShelfBasicHeaderRenderer")?.optJSONObject("title")?.optJSONArray("runs")).ifEmpty { "For You" }
                val contents = shelf.optJSONArray("contents") ?: return@walk
                if (Regex("playlist|community", RegexOption.IGNORE_CASE).containsMatchIn(title)) {
                    for (i in 0 until contents.length()) parseTwoRowItem(contents.opt(i))?.let(playlists::add)
                    return@walk
                }
                val items = mutableListOf<Track>()
                for (i in 0 until contents.length()) parseResponsiveListItem(contents.opt(i))?.let(items::add)
                val uniq = dedupe(items)
                if (uniq.size >= 3 && seenTitles.add(title)) shelves.add(Shelf(title, uniq.take(18)))
            }
        }
        return shelves to playlists
    }

    // ---------- browse pages ----------

    private fun headerFromDoc(doc: JSONObject): Triple<String, String, String> {
        var header: JSONObject? = null
        walk(doc) { node -> if (header == null) header = node.optJSONObject("musicResponsiveHeaderRenderer") }
        val h = header ?: return Triple("Unknown", "", "")
        val title = runsText(h.optJSONObject("title")?.optJSONArray("runs")).ifEmpty { "Unknown" }
        val second = runsText(h.optJSONObject("secondSubtitle")?.optJSONArray("runs"))
        val first = runsText(h.optJSONObject("subtitle")?.optJSONArray("runs"))
        val meta = listOf(first, second).filter { it.isNotEmpty() }.joinToString(" · ")
        val thumbnail = bestThumb(h.optJSONObject("thumbnail")?.optJSONObject("musicThumbnailRenderer")?.optJSONObject("thumbnail")?.optJSONArray("thumbnails"))
        return Triple(title, meta, thumbnail)
    }

    private fun browseTracks(doc: JSONObject): List<Track> {
        val tracks = mutableListOf<Track>()
        val seen = HashSet<String>()
        walk(doc) { node ->
            val section = node.optJSONObject("musicRowSectionRenderer") ?: node.optJSONObject("musicShelfRenderer") ?: return@walk
            val contents = section.optJSONArray("contents") ?: return@walk
            for (i in 0 until contents.length()) {
                val t = parseResponsiveListItem(contents.opt(i)) ?: continue
                if (seen.add(t.id)) tracks.add(t)
            }
        }
        return tracks
    }

    fun browsePage(doc: JSONObject, kind: String, rawId: String): PageInfo {
        val (title, meta, thumbnail) = headerFromDoc(doc)
        val id = rawId.replace(Regex("^(MPRE|OLAK5|MP)"), "")
        return PageInfo(id = id, title = title, meta = meta, thumbnail = thumbnail, kind = kind, tracks = browseTracks(doc))
    }

    fun playlistPage(doc: JSONObject, cleanId: String): PageInfo {
        val (title, meta, thumbnail) = headerFromDoc(doc)
        val tracks = mutableListOf<Track>()
        walk(doc) { node ->
            val shelf = node.optJSONObject("musicPlaylistShelfRenderer") ?: return@walk
            val contents = shelf.optJSONArray("contents") ?: return@walk
            for (i in 0 until contents.length()) parseResponsiveListItem(contents.opt(i))?.let(tracks::add)
        }
        return PageInfo(id = cleanId, title = title, meta = meta, thumbnail = thumbnail, kind = "playlist", tracks = tracks)
    }

    // ---------- charts ----------

    private val CHART_QUERIES = mapOf(
        "id" to listOf("lagu trending", "lagu viral", "lagu teratas", "musik baru"),
        "ms" to listOf("lagu trending", "lagu viral", "lagu teratas", "muzik baharu"),
        "ja" to listOf("トレンド曲", "バイラル曲", "チャート曲", "新曲"),
        "ko" to listOf("인기곡", "바이러스 곡", "차트 곡", "신곡"),
        "zh" to listOf("热门歌曲", "热门歌曲", "榜单歌曲", "新歌"),
        "th" to listOf("เพลงยอดนิยม", "เพลงไวรัล", "เพลงชาร์ต", "เพลงใหม่"),
        "vi" to listOf("nhạc thịnh hành", "nhạc viral", "bản xếp hạng", "nhạc mới"),
        "es" to listOf("canciones de moda", "canciones virales", "canciones top", "musica nueva"),
        "fr" to listOf("chansons tendance", "chansons virales", "chansons top", "nouveaute"),
        "ar" to listOf("أغاني رائجة", "أغاني فيروسية", "أغاني توب", "موسيقى جديدة"),
        "pt" to listOf("musicas em alta", "musicas virais", "musicas top", "musica nova"),
        "de" to listOf("trending songs", "virale songs", "top songs", "neue musik"),
    )

    fun chartQueries(hl: String): List<String> =
        CHART_QUERIES[hl] ?: listOf("trending songs", "viral songs", "top hits 2026", "new music")
}
