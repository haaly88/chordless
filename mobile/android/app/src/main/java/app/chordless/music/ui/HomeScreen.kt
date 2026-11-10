package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.data.Innertube
import app.chordless.music.data.LocalStore
import app.chordless.music.data.PlaylistCard
import app.chordless.music.data.Shelf
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager

@Composable
fun HomeScreen(
    onPlay: (Track, List<Track>) -> Unit,
    onOpenPlaylist: (PlaylistCard) -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenSmart: (String) -> Unit,
    gl: String,
    hl: String,
) {
    val ctx = LocalContext.current
    var shelves by remember { mutableStateOf<List<Shelf>>(emptyList()) }
    var playlists by remember { mutableStateOf<List<PlaylistCard>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var retryTick by remember { mutableStateOf(0) }
    var favCount by remember { mutableStateOf(0) }
    var histCount by remember { mutableStateOf(0) }

    LaunchedEffect(gl, hl, retryTick) {
        loading = true
        error = null
        favCount = LocalStore.favorites(ctx).size
        histCount = LocalStore.history(ctx).size
        try {
            val (s, p) = Innertube.homeShelves(gl, hl)
            shelves = s
            playlists = p
        } catch (e: Exception) {
            error = e.message
        }
        loading = false
    }

    // keep fav/history counts fresh after playback
    val currentTrack by PlayerManager.current.collectAsState()
    val currentId = currentTrack?.id
    LaunchedEffect(currentId) {
        favCount = LocalStore.favorites(ctx).size
        histCount = LocalStore.history(ctx).size
    }

    AuroraBackground {
        if (loading && shelves.isEmpty()) {
            LoadingBox()
            return@AuroraBackground
        }
        if (error != null && shelves.isEmpty()) {
            ErrorBox(error ?: "Failed to load") { retryTick++ }
            return@AuroraBackground
        }
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(horizontal = 24.dp, vertical = 24.dp)) {
                    Text("Chordless", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.W800)
                    Text(
                        "Every song, beautifully.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                ForYouHero(onPlay = onPlay, fallback = shelves.firstOrNull()?.items?.firstOrNull())
            }
            item {
                QuickTiles(
                    favCount = favCount,
                    histCount = histCount,
                    onOpenFavorites = onOpenFavorites,
                    onOpenHistory = onOpenHistory,
                    onOpenSmart = onOpenSmart,
                )
            }
            shelves.forEach { shelf ->
                item {
                    SectionHeader(
                        title = shelf.title,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(18.dp),
                        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 6.dp),
                    ) {
                        items(shelf.items) { track ->
                            CoverCard(
                                title = track.title,
                                subtitle = track.artist,
                                image = track.thumbnail,
                                onClick = { onPlay(track, shelf.items) },
                                size = 210.dp,
                            )
                        }
                    }
                }
            }
            if (playlists.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Playlists",
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 16.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(18.dp),
                        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 6.dp),
                    ) {
                        items(playlists) { card ->
                            CoverCard(
                                title = card.title,
                                subtitle = card.author.ifBlank { card.views },
                                image = card.thumbnail,
                                onClick = { onOpenPlaylist(card) },
                                size = 210.dp,
                            )
                        }
                    }
                }
            }
        }
    }
}

/** For You hero — large gradient card with play-all. */
@Composable
private fun ForYouHero(onPlay: (Track, List<Track>) -> Unit, fallback: Track?) {
    val current by PlayerManager.current.collectAsState()
    val playTrack = current ?: fallback
    Row(
        modifier = Modifier
            .padding(horizontal = 24.dp, vertical = 10.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(32.dp))
            .background(
                Brush.linearGradient(
                    listOf(
                        MaterialTheme.colorScheme.primary,
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.50f),
                    )
                )
            )
            .padding(28.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("FOR YOU", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f))
            Spacer(Modifier.height(8.dp))
            Text(
                "Your daily mix, made for you.",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onPrimary,
            )
            Spacer(Modifier.height(18.dp))
            Button(
                onClick = { if (playTrack != null) onPlay(playTrack, listOf(playTrack)) },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.onPrimary),
                shape = CircleShape,
            ) {
                Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(8.dp))
                Text("Play", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            }
        }
        if (playTrack != null) Artwork(playTrack.thumbnail, size = 140.dp, radius = 24.dp)
    }
}

/** Quick tiles — rounded action buttons. */
@Composable
private fun QuickTiles(
    favCount: Int,
    histCount: Int,
    onOpenFavorites: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenSmart: (String) -> Unit,
) {
    val tiles = listOf(
        Triple("Favorites", "$favCount tracks", onOpenFavorites),
        Triple("History", "$histCount played", onOpenHistory),
        Triple("Recently Added", "Fresh picks", { onOpenSmart("recent") }),
        Triple("Most Played", "Top repeats", { onOpenSmart("played") }),
        Triple("Top Rated", "Most loved", { onOpenSmart("rated") }),
    )
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(horizontal = 24.dp, vertical = 16.dp),
    ) {
        items(tiles) { (title, sub, action) ->
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(22.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.75f))
                    .clickable(onClick = action)
                    .padding(18.dp)
                    .width(160.dp),
            ) {
                val icon = when (title) {
                    "Favorites" -> Icons.Filled.Favorite
                    "History" -> Icons.Filled.History
                    "Most Played" -> Icons.Filled.TrendingUp
                    "Recently Added" -> Icons.Filled.Speed
                    else -> Icons.Filled.TrendingUp
                }
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(12.dp))
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
