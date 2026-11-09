package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.chordless.music.data.LocalStore
import app.chordless.music.data.PlaylistCard
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import kotlinx.coroutines.launch

private sealed interface Screen {
    data object Home : Screen
    data object Search : Screen
    data object Library : Screen
    data object Settings : Screen
    data object Eq : Screen
    data object NowPlaying : Screen
    data class Page(val kind: String, val rawId: String) : Screen
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChordlessApp() {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }
    var showQueue by remember { mutableStateOf(false) }
    var actionTrack by remember { mutableStateOf<Track?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        gl = app.chordless.music.data.Prefs.gl(ctx)
        hl = app.chordless.music.data.Prefs.hl(ctx)
    }

    val current by PlayerManager.current.collectAsState()
    val isPlaying by PlayerManager.isPlaying.collectAsState()
    val loading by PlayerManager.loading.collectAsState()
    val position by PlayerManager.positionMs.collectAsState()

    fun play(track: Track, q: List<Track>) = PlayerManager.play(track, q)
    fun playSingle(track: Track) = PlayerManager.play(track)

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            Column {
                if (current != null && screen !is Screen.NowPlaying) {
                    PlayerBar(
                        track = current!!,
                        isPlaying = isPlaying,
                        loading = loading,
                        positionMs = position,
                        onOpen = { screen = Screen.NowPlaying },
                    )
                }
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)) {
                    NavigationBarItem(
                        selected = screen is Screen.Home,
                        onClick = { screen = Screen.Home },
                        icon = { Icon(Icons.Filled.Home, contentDescription = "Home") },
                        label = { Text("Home") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                    NavigationBarItem(
                        selected = screen is Screen.Search,
                        onClick = { screen = Screen.Search },
                        icon = { Icon(Icons.Filled.Search, contentDescription = "Search") },
                        label = { Text("Search") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                    NavigationBarItem(
                        selected = screen is Screen.Library,
                        onClick = { screen = Screen.Library },
                        icon = { Icon(Icons.Filled.LibraryMusic, contentDescription = "Library") },
                        label = { Text("Library") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                    NavigationBarItem(
                        selected = screen is Screen.Settings,
                        onClick = { screen = Screen.Settings },
                        icon = { Icon(Icons.Filled.Settings, contentDescription = "Settings") },
                        label = { Text("Settings") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val s = screen) {
                is Screen.Home -> HomeScreen(
                    onPlay = { t, q -> play(t, q) },
                    onOpenPlaylist = { card: PlaylistCard -> screen = Screen.Page("playlist", card.id) },
                    onOpenFavorites = { /* library smart */ screen = Screen.Library },
                    onOpenHistory = { screen = Screen.Library },
                    onOpenSmart = { screen = Screen.Library },
                    gl = gl,
                    hl = hl,
                )
                is Screen.Search -> SearchScreen(
                    onPlay = { t, q -> play(t, q) },
                    onOpenArtist = { track: Track -> screen = Screen.Page("artist", track.browseId ?: track.id) },
                    onOpenAlbum = { track: Track -> screen = Screen.Page("album", track.browseId ?: track.id) },
                    onTrackAction = { actionTrack = it },
                )
                is Screen.Library -> LibraryScreen(
                    onPlay = { t, q -> play(t, q) },
                    onTrackAction = { actionTrack = it },
                )
                is Screen.Settings -> SettingsScreen(onOpenEq = { screen = Screen.Eq })
                is Screen.Eq -> EqScreen()
                is Screen.NowPlaying -> NowPlayingScreen(
                    onOpenQueue = { showQueue = true },
                    onShareCard = { track, pos, dur ->
                        scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                            try {
                                val file = ShareCard.create(ctx, track, pos, dur, "")
                                with(kotlinx.coroutines.Dispatchers.Main) {
                                    ctx.startActivity(ShareCard.shareIntent(ctx, file))
                                }
                            } catch (e: Exception) {
                                with(kotlinx.coroutines.Dispatchers.Main) {
                                    scope.launch { snackbar.showSnackbar("Share failed: ${e.message}") }
                                }
                            }
                        }
                    },
                )
                is Screen.Page -> PageScreen(
                    kind = s.kind,
                    rawId = s.rawId,
                    onPlay = { t, q -> play(t, q) },
                    onTrackAction = { actionTrack = it },
                )
            }
        }
    }

    if (showQueue) {
        QueueSheet(onDismiss = { showQueue = false }, snackbar = snackbar)
    }

    actionTrack?.let { track ->
        TrackActionSheet(
            track = track,
            onDismiss = { actionTrack = null },
            onPlayNext = {
                PlayerManager.playNextInQueue(track)
                actionTrack = null
                scope.launch { snackbar.showSnackbar("Added to queue") }
            },
            onAddToQueue = {
                PlayerManager.addToQueue(track)
                actionTrack = null
                scope.launch { snackbar.showSnackbar("Added to queue") }
            },
            onToggleFavorite = {
                scope.launch {
                    val favs = LocalStore.favorites(ctx)
                    val nowFav = favs.none { it.id == track.id }
                    LocalStore.setFavorite(ctx, track, nowFav)
                    snackbar.showSnackbar(if (nowFav) "Added to favorites" else "Removed from favorites")
                }
                actionTrack = null
            },
            onAddToPlaylist = {
                scope.launch {
                    val playlists = LocalStore.playlists(ctx)
                    val target = playlists.firstOrNull()
                    if (target != null) {
                        LocalStore.addToPlaylist(ctx, target.id, track)
                        snackbar.showSnackbar("Added to ${target.name}")
                    } else {
                        val created = LocalStore.createPlaylist(ctx, "Playlist")
                        LocalStore.addToPlaylist(ctx, created.id, track)
                        snackbar.showSnackbar("Created playlist + added")
                    }
                }
                actionTrack = null
            },
        )
    }
}

@Composable
private fun PlayerBar(
    track: Track,
    isPlaying: Boolean,
    loading: Boolean,
    positionMs: Long,
    onOpen: () -> Unit,
) {
    val sleepChip = PlayerManager.sleepChip()
    Box(
        modifier = Modifier
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .shadow(16.dp, RoundedCornerShape(24.dp))
            .clip(RoundedCornerShape(24.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.92f))
            .clickable(onClick = onOpen)
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Artwork(track.thumbnail, size = 48.dp, radius = 14.dp)
            Column(modifier = Modifier.weight(1f)) {
                MarqueeText(text = track.title, style = MaterialTheme.typography.bodyLarge)
                androidx.compose.material3.Text(
                    (if (loading) "Loading… " else "") + (sleepChip?.let { "Sleep $it · " } ?: "") + track.artist,
                    maxLines = 1,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { PlayerManager.toggle() }) {
                Icon(
                    if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = "Play/Pause",
                    modifier = Modifier.size(36.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
        val dur = PlayerManager.durationMs()
        if (dur > 0) {
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 12.dp, vertical = 2.dp)
                    .fillMaxWidth()
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(percent = 50))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
            ) {
                androidx.compose.foundation.layout.Box(
                    modifier = Modifier
                        .fillMaxWidth((positionMs.toFloat() / dur).coerceIn(0f, 1f))
                        .padding(vertical = 1.dp)
                        .clip(androidx.compose.foundation.shape.RoundedCornerShape(percent = 50))
                        .background(MaterialTheme.colorScheme.primary),
                ) {}
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrackActionSheet(
    track: Track,
    onDismiss: () -> Unit,
    onPlayNext: () -> Unit,
    onAddToQueue: () -> Unit,
    onToggleFavorite: () -> Unit,
    onAddToPlaylist: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState()) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(track.title, style = MaterialTheme.typography.titleMedium, maxLines = 1)
            Text(track.artist, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            androidx.compose.foundation.layout.Spacer(Modifier.size(16.dp))
            ActionRow("Play next", onPlayNext)
            ActionRow("Add to queue", onAddToQueue)
            ActionRow("Like / Unlike", onToggleFavorite)
            ActionRow("Add to playlist", onAddToPlaylist)
            androidx.compose.foundation.layout.Spacer(Modifier.size(12.dp))
            androidx.compose.material3.TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    }
}

@Composable
private fun ActionRow(label: String, onClick: () -> Unit) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}
