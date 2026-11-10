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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.R
import app.chordless.music.data.Innertube
import app.chordless.music.data.LocalStore
import app.chordless.music.data.PlaylistCard
import app.chordless.music.data.Shelf
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager

private fun greeting(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when {
        hour < 5 -> "Still up?"
        hour < 12 -> "Good morning"
        hour < 17 -> "Good afternoon"
        hour < 21 -> "Good evening"
        else -> "Good night"
    }
}

@Composable
fun HomeScreen(
    onPlay: (Track, List<Track>) -> Unit,
    onOpenPlaylist: (PlaylistCard) -> Unit,
    onOpenFavorites: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenSmart: (String) -> Unit,
    onOpenDownloads: () -> Unit,
    onOpenStats: () -> Unit,
    onOpenTogether: () -> Unit,
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
    var selectedChip by remember { mutableStateOf("For you") }

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

    val currentTrack by PlayerManager.current.collectAsState()
    LaunchedEffect(currentTrack?.id) {
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
            contentPadding = PaddingValues(bottom = 210.dp),
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            // ---------- Masthead ----------
            item {
                Column(modifier = Modifier.padding(horizontal = Chordless.gutter)) {
                    Spacer(Modifier.height(14.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Chordless",
                                style = MaterialTheme.typography.headlineLarge,
                                fontWeight = FontWeight.W900,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Text(
                                greeting(),
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f))
                                .padding(horizontal = 14.dp, vertical = 8.dp),
                        ) {
                            Text(
                                "$gl · $hl".uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                }
            }

            // ---------- Hero ----------
            item {
                HeroCard(
                    track = currentTrack ?: shelves.firstOrNull()?.items?.firstOrNull(),
                    onPlay = { track -> onPlay(track, listOf(track)) },
                    modifier = Modifier.padding(horizontal = Chordless.gutter),
                )
                Spacer(Modifier.height(26.dp))
            }

            // ---------- Quick picks ----------
            item {
                SectionHeading(
                    title = "Quick picks",
                    modifier = Modifier.padding(horizontal = Chordless.gutter),
                )
                Spacer(Modifier.height(12.dp))
                QuickGrid(
                    favCount = favCount,
                    histCount = histCount,
                    onOpenFavorites = onOpenFavorites,
                    onOpenHistory = onOpenHistory,
                    onOpenSmart = onOpenSmart,
                    onOpenDownloads = onOpenDownloads,
                    onOpenStats = onOpenStats,
                    onOpenTogether = onOpenTogether,
                )
                Spacer(Modifier.height(26.dp))
            }

            // ---------- Genre chips ----------
            item {
                val chips = listOf(
                    "For you" to null,
                    "Pop" to "Pop",
                    "Rock" to "Rock",
                    "Jazz" to "Jazz",
                    "Hip-Hop" to "Hip-Hop",
                    "Electronic" to "Electronic",
                    "Indonesia" to "Indonesia",
                    "Chill" to "Chill",
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(horizontal = Chordless.gutter),
                ) {
                    items(chips) { (label, _) ->
                        PillChip(
                            label = label,
                            selected = selectedChip == label,
                            onClick = { selectedChip = label },
                        )
                    }
                }
                Spacer(Modifier.height(26.dp))
            }

            // ---------- Shelves ----------
            shelves.forEach { shelf ->
                item {
                    SectionHeading(
                        title = shelf.title,
                        modifier = Modifier.padding(horizontal = Chordless.gutter),
                        action = "See all",
                        onAction = { },
                    )
                    Spacer(Modifier.height(12.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        contentPadding = PaddingValues(horizontal = Chordless.gutter),
                    ) {
                        items(shelf.items) { track ->
                            ShelfCard(
                                track = track,
                                onClick = { onPlay(track, shelf.items) },
                            )
                        }
                    }
                    Spacer(Modifier.height(26.dp))
                }
            }

            // ---------- Playlists ----------
            if (playlists.isNotEmpty()) {
                item {
                    SectionHeading(
                        title = "Your playlists",
                        modifier = Modifier.padding(horizontal = Chordless.gutter),
                    )
                    Spacer(Modifier.height(12.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        contentPadding = PaddingValues(horizontal = Chordless.gutter),
                    ) {
                        items(playlists) { card ->
                            Column(modifier = Modifier.width(150.dp)) {
                                BigCoverTile(
                                    title = card.title,
                                    subtitle = card.author.ifBlank { card.views },
                                    image = card.thumbnail,
                                    onClick = { onOpenPlaylist(card) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(150.dp),
                                )
                                Spacer(Modifier.height(8.dp))
                                Text(
                                    card.title,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.W700,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    maxLines = 1,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                }
            }
        }
    }
}

/** Big accent hero card with the current / first track. */
@Composable
private fun HeroCard(
    track: Track?,
    onPlay: (Track) -> Unit,
    modifier: Modifier = Modifier,
) {
    AccentPanel(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "MADE FOR YOU",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White.copy(alpha = 0.82f),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    track?.title ?: "Pick something to play",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.W800,
                    color = Color.White,
                    maxLines = 2,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    track?.artist.orEmpty(),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.78f),
                    maxLines = 1,
                )
                Spacer(Modifier.height(16.dp))
                Button(
                    onClick = { if (track != null) onPlay(track) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                    shape = CircleShape,
                ) {
                    Icon(
                        Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Play",
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.W800,
                    )
                }
            }
            Spacer(Modifier.width(14.dp))
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(132.dp)
                        .clip(RoundedCornerShape(30.dp))
                        .background(
                            Brush.radialGradient(
                                listOf(
                                    Color.White.copy(alpha = 0.30f),
                                    Color.Transparent,
                                )
                            )
                        )
                )
                Artwork(
                    track?.thumbnail ?: "",
                    size = 118.dp,
                    radius = 26.dp,
                )
            }
        }
    }
}

/** Two column grid of large entry tiles. */
@Composable
private fun QuickGrid(
    favCount: Int,
    histCount: Int,
    onOpenFavorites: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenSmart: (String) -> Unit,
    onOpenDownloads: () -> Unit,
    onOpenStats: () -> Unit,
    onOpenTogether: () -> Unit,
) {
    val tiles = listOf(
        QuickTile("Favorites", "$favCount tracks", R.drawable.cover_1, onOpenFavorites),
        QuickTile("History", "$histCount played", R.drawable.cover_2, onOpenHistory),
        QuickTile("Recently added", "Fresh picks", R.drawable.cover_3, { onOpenSmart("recent") }),
        QuickTile("Most played", "Top repeats", R.drawable.cover_4, { onOpenSmart("played") }),
        QuickTile("Downloads", "Offline ready", R.drawable.cover_5, onOpenDownloads),
        QuickTile("Statistics", "Your listening", R.drawable.cover_6, onOpenStats),
        QuickTile("Listen together", "Sync with friends", R.drawable.cover_7, onOpenTogether),
    )
    Column(
        modifier = Modifier.padding(horizontal = Chordless.gutter),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        tiles.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                row.forEach { tile ->
                    BigCoverTile(
                        title = tile.title,
                        subtitle = tile.subtitle,
                        image = "",
                        onClick = tile.action,
                        modifier = Modifier
                            .weight(1f)
                            .height(128.dp),
                        drawable = tile.art,
                    )
                }
                if (row.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

private data class QuickTile(
    val title: String,
    val subtitle: String,
    val art: Int,
    val action: () -> Unit,
)

/** Shelf card — cover with title overlay. */
@Composable
private fun ShelfCard(track: Track, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(150.dp)
            .clickable(onClick = onClick),
    ) {
        BigCoverTile(
            title = track.title,
            subtitle = track.artist,
            image = track.thumbnail,
            onClick = onClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(150.dp),
        )
        Spacer(Modifier.height(8.dp))
        Text(
            track.title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.W700,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
        )
        Text(
            track.artist,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
        )
    }
}
