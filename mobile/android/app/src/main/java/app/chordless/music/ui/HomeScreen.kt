package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
            contentPadding = PaddingValues(bottom = 28.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp)) {
                    Text("Chordless", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        "Every song, beautifully.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                ForYouHero(onPlay = onPlay)
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
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                    ) {
                        items(shelf.items) { track ->
                            CoverCard(
                                title = track.title,
                                subtitle = track.artist,
                                image = track.thumbnail,
                                onClick = { onPlay(track, shelf.items) },
                            )
                        }
                    }
                }
            }
            if (playlists.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Playlists",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                    )
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                    ) {
                        items(playlists) { card ->
                            CoverCard(
                                title = card.title,
                                subtitle = card.author.ifBlank { card.views },
                                image = card.thumbnail,
                                onClick = { onOpenPlaylist(card) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** For You hero — desktop-style gradient card with play-all. */
@Composable
private fun ForYouHero(onPlay: (Track, List<Track>) -> Unit) {
    val current by PlayerManager.current.collectAsState()
    val first = current
    Row(
        modifier = Modifier
            .padding(horizontal = 20.dp, vertical = 8.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(
                Brush.linearGradient(
                    listOf(
                        MaterialTheme.colorScheme.primary,
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                    )
                )
            )
            .padding(22.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text("FOR YOU", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.8f))
            Spacer(Modifier.height(6.dp))
            Text(
                "Your daily mix, made for you.",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimary,
            )
            Spacer(Modifier.height(14.dp))
            Button(
                onClick = { if (first != null) onPlay(first, listOf(first)) },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.onPrimary),
                shape = CircleShape,
            ) {
                Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(6.dp))
                Text("Play", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
            }
        }
        if (first != null) Artwork(first.thumbnail, size = 110.dp, radius = 20.dp)
    }
}

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
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
    ) {
        items(tiles) { (title, sub, action) ->
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f))
                    .clickable(onClick = action)
                    .padding(16.dp)
                    .width(150.dp),
            ) {
                val icon = when (title) {
                    "Favorites" -> Icons.Filled.Favorite
                    "History" -> Icons.Filled.History
                    "Most Played" -> Icons.Filled.TrendingUp
                    "Recently Added" -> Icons.Filled.Speed
                    else -> Icons.Filled.TrendingUp
                }
                Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(10.dp))
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
