package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.data.Innertube
import app.chordless.music.data.PlaylistCard
import app.chordless.music.data.Shelf
import app.chordless.music.data.Track
import coil.compose.AsyncImage

@Composable
fun HomeScreen(
    onPlay: (Track, List<Track>) -> Unit,
    onOpenPlaylist: (PlaylistCard) -> Unit,
    gl: String,
    hl: String,
) {
    var shelves by remember { mutableStateOf<List<Shelf>>(emptyList()) }
    var playlists by remember { mutableStateOf<List<PlaylistCard>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var retryTick by remember { mutableStateOf(0) }

    LaunchedEffect(gl, hl, retryTick) {
        loading = true
        error = null
        try {
            val (s, p) = Innertube.homeShelves(gl, hl)
            shelves = s
            playlists = p
        } catch (e: Exception) {
            error = e.message
        }
        loading = false
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // aurora backdrop
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.linearGradient(
                    listOf(
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.18f),
                        Color.Transparent,
                        MaterialTheme.colorScheme.background,
                    ),
                )
            )
        )
        if (loading) {
            LoadingBox()
            return@Box
        }
        if (error != null && shelves.isEmpty()) {
            ErrorBox(error ?: "Failed to load") { retryTick++ }
            return@Box
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp)) {
                    Text(
                        "Chordless",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Every song, beautifully.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            shelves.forEach { shelf ->
                item {
                    Text(
                        shelf.title,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                    ) {
                        items(shelf.items) { track ->
                            Column(modifier = Modifier.width(168.dp).clickable { onPlay(track, shelf.items) }) {
                                AsyncImage(
                                    model = track.thumbnail,
                                    contentDescription = null,
                                    modifier = Modifier.size(168.dp).clip(androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
                                    contentScale = ContentScale.Crop,
                                )
                                Text(
                                    track.title,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(top = 10.dp),
                                )
                                Text(
                                    track.artist,
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
            if (playlists.isNotEmpty()) {
                item {
                    Text(
                        "Playlists",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                    ) {
                        items(playlists) { card ->
                            Column(modifier = Modifier.width(168.dp).clickable { onOpenPlaylist(card) }) {
                                AsyncImage(
                                    model = card.thumbnail,
                                    contentDescription = null,
                                    modifier = Modifier.size(168.dp).clip(androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
                                    contentScale = ContentScale.Crop,
                                )
                                Text(card.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 10.dp))
                                Text(card.author.ifBlank { card.views }, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
        }
    }
}
