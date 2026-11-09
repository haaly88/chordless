package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Innertube
import app.chordless.music.data.PageInfo
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track
import androidx.compose.ui.platform.LocalContext

/** Generic page for artist / album / playlist — desktop-style header. */
@Composable
fun PageScreen(
    kind: String,
    rawId: String,
    onPlay: (Track, List<Track>) -> Unit,
    onTrackAction: (Track) -> Unit,
) {
    val ctx = LocalContext.current
    var page by remember { mutableStateOf<PageInfo?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var retry by remember { mutableStateOf(0) }

    LaunchedEffect(kind, rawId, retry) {
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

    AuroraBackground {
        if (loading) {
            LoadingBox()
            return@AuroraBackground
        }
        if (page == null) {
            ErrorBox(error ?: "Failed to load") { retry++ }
            return@AuroraBackground
        }
        val p = page!!
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item {
                Row(
                    modifier = Modifier.padding(20.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    Artwork(p.thumbnail, size = 150.dp, radius = 24.dp)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            kind.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            p.title,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        if (p.meta.isNotBlank()) {
                            Text(
                                p.meta,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            "${p.tracks.size} tracks",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = { p.tracks.firstOrNull()?.let { onPlay(it, p.tracks) } },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            shape = CircleShape,
                        ) {
                            androidx.compose.material3.Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
                            Text("Play all", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
            itemsIndexed(p.tracks) { i, track ->
                Box(modifier = Modifier.padding(horizontal = 8.dp)) {
                    TrackRow(
                        track = track,
                        index = i,
                        onClick = { onPlay(track, p.tracks) },
                        onLongClick = { onTrackAction(track) },
                    )
                }
            }
        }
    }
}
