package app.chordless.music.data

/** A playable track or a navigable entity (artist/album) — mirrors the web app's track shape. */
data class Track(
    val id: String,                 // videoId for songs/videos; browse-stripped id for artist/album rows
    val title: String,
    val artist: String = "",
    val album: String? = null,
    val kind: String = "track",     // song | video | album | artist | track
    val duration: Long = 0,
    val thumbnail: String = "",
    val browseId: String? = null,   // present for artist/album rows (navigation)
)

data class Shelf(val title: String, val items: List<Track>)

data class PlaylistCard(
    val id: String,
    val title: String,
    val author: String = "",
    val views: String = "",
    val thumbnail: String = "",
)

data class PageInfo(
    val id: String,
    val title: String,
    val meta: String = "",
    val thumbnail: String = "",
    val kind: String = "",
    val tracks: List<Track> = emptyList(),
)
