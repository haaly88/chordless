package app.chordless.music.ui

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Innertube
import app.chordless.music.data.PageInfo
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track

/** Generic page for artist / album / playlist. */
@Composable
fun PageScreen(
    kind: String,
    rawId: String,
    onPlay: (Track, List<Track>) -> Unit,
) {
    val ctx = LocalContext.current
    var page by remember { mutableStateOf<PageInfo?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(rawId) {
        loading = true
        error = null
        try {
            val gl = Prefs.gl(ctx)
            val hl = Prefs.hl(ctx)
            page = when (kind) {
                "artist" -> Innertube.artist(rawId, gl, hl)
                "album" -> Innertube.album(rawId, gl, hl)
                else -> Innertube.playlist(rawId, gl, hl)
            }
        } catch (e: Exception) {
            error = e.message
        }
        loading = false
    }

    if (loading) {
        LoadingBox()
        return
    }
    if (page == null) {
        ErrorBox(error ?: "Failed to load") { }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
    ) {
        item {
            Text(page!!.title, style = MaterialTheme.typography.headlineSmall)
            if (page!!.meta.isNotBlank()) {
                Text(page!!.meta, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        items(page!!.tracks) { track ->
            TrackRow(track = track, onClick = { onPlay(track, page!!.tracks) })
        }
    }
}
