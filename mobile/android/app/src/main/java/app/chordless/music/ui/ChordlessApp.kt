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
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.Icons
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.NavType
import app.chordless.music.data.LocalStore
import app.chordless.music.data.PlaylistCard
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import dev.chrisbanes.haze.HazeDefaults
import dev.chrisbanes.haze.hazeEffect
import dev.chrisbanes.haze.hazeSource
import dev.chrisbanes.haze.HazeState
import kotlinx.coroutines.launch

private const val ROUTE_HOME = "home"
private const val ROUTE_SEARCH = "search"
private const val ROUTE_LIBRARY = "library"
private const val ROUTE_SETTINGS = "settings"
private const val ROUTE_EQ = "eq"
private const val ROUTE_NOW_PLAYING = "nowPlaying"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChordlessApp() {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val haptics = LocalHapticFeedback.current
    val snackbar = remember { SnackbarHostState() }
    val nav = rememberNavController()
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }
    var showQueue by remember { mutableStateOf(false) }
    var actionTrack by remember { mutableStateOf<Track?>(null) }
    var update by remember { mutableStateOf<app.chordless.music.data.UpdateRepo.Update?>(null) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        gl = app.chordless.music.data.Prefs.gl(ctx)
        hl = app.chordless.music.data.Prefs.hl(ctx)
        update = app.chordless.music.data.UpdateRepo.check()
        update?.let { u ->
            val res = snackbar.showSnackbar(
                message = "Chordless ${u.version} is available",
                actionLabel = "Download",
            )
            if (res == SnackbarResult.ActionPerformed) {
                try {
                    ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(u.url)))
                } catch (e: Exception) {
                    // ignore
                }
            }
        }
    }

    val current by PlayerManager.current.collectAsState()
    val isPlaying by PlayerManager.isPlaying.collectAsState()
    val loading by PlayerManager.loading.collectAsState()
    val position by PlayerManager.positionMs.collectAsState()
    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    fun play(track: Track, q: List<Track>) {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        PlayerManager.play(track, q)
    }
    fun playSingle(track: Track) {
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
        PlayerManager.play(track)
    }

    val hazeBarTint = MaterialTheme.colorScheme.surface.copy(alpha = 0.75f)
    val hazeState = remember { HazeState() }

    Box(modifier = Modifier.fillMaxSize()) {
        NavHost(
            navController = nav,
            startDestination = ROUTE_HOME,
            modifier = Modifier.hazeSource(hazeState),
        ) {
            composable(ROUTE_HOME) {
                HomeScreen(
                    onPlay = { t, q -> play(t, q) },
                    onOpenPlaylist = { card: PlaylistCard -> nav.navigate("page/playlist/${card.id}") },
                    onOpenFavorites = { nav.navigate(ROUTE_LIBRARY) },
                    onOpenHistory = { nav.navigate(ROUTE_LIBRARY) },
                    onOpenSmart = { nav.navigate(ROUTE_LIBRARY) },
                    gl = gl,
                    hl = hl,
                )
            }
            composable(ROUTE_SEARCH) {
                SearchScreen(
                    onPlay = { t, q -> play(t, q) },
                    onOpenArtist = { track: Track -> nav.navigate("page/artist/${track.browseId ?: track.id}") },
                    onOpenAlbum = { track: Track -> nav.navigate("page/album/${track.browseId ?: track.id}") },
                    onTrackAction = { actionTrack = it },
                )
            }
            composable(ROUTE_LIBRARY) {
                LibraryScreen(
                    onPlay = { t, q -> play(t, q) },
                    onTrackAction = { actionTrack = it },
                )
            }
            composable(ROUTE_SETTINGS) {
                SettingsScreen(onOpenEq = { nav.navigate(ROUTE_EQ) })
            }
            composable(ROUTE_EQ) { EqScreen() }
            composable(ROUTE_NOW_PLAYING) {
                NowPlayingScreen(
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
            }
            composable(
                route = "page/{kind}/{rawId}",
                arguments = listOf(
                    navArgument("kind") { type = NavType.StringType },
                    navArgument("rawId") { type = NavType.StringType },
                ),
            ) { entry ->
                PageScreen(
                    kind = entry.arguments?.getString("kind") ?: "",
                    rawId = entry.arguments?.getString("rawId") ?: "",
                    onPlay = { t, q -> play(t, q) },
                    onTrackAction = { actionTrack = it },
                )
            }
        }

        // Frosted-glass bars (Haze) — mini player + bottom navigation.
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .windowInsetsPadding(WindowInsets.systemBars),
        ) {
            if (current != null && currentRoute != ROUTE_NOW_PLAYING) {
                NowPlayingMiniPlayer(
                    track = current,
                    isPlaying = isPlaying,
                    loading = loading,
                    positionMs = position,
                    onOpen = {
                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        nav.navigate(ROUTE_NOW_PLAYING)
                    },
                    modifier = Modifier.hazeEffect(hazeState) {
                        blurRadius = HazeDefaults.blurRadius
                        backgroundColor = hazeBarTint
                    },
                )
            }
            NavigationBar(
                containerColor = androidx.compose.ui.graphics.Color.Transparent,
                modifier = Modifier.hazeEffect(hazeState) {
                    blurRadius = HazeDefaults.blurRadius
                    backgroundColor = hazeBarTint
                },
            ) {
                val itemColors = NavigationBarItemDefaults.colors(
                    selectedIconColor = MaterialTheme.colorScheme.primary,
                    selectedTextColor = MaterialTheme.colorScheme.primary,
                    unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                NavigationBarItem(
                    selected = currentRoute == ROUTE_HOME,
                    onClick = { nav.navigate(ROUTE_HOME) { popUpTo(nav.graph.startDestinationId) { saveState = true }; launchSingleTop = true; restoreState = true } },
                    icon = { Icon(Icons.Filled.Home, contentDescription = "Home", modifier = Modifier.size(30.dp)) },
                    label = { Text("Home", style = MaterialTheme.typography.labelLarge) },
                    colors = itemColors,
                )
                NavigationBarItem(
                    selected = currentRoute == ROUTE_SEARCH,
                    onClick = { nav.navigate(ROUTE_SEARCH) { popUpTo(nav.graph.startDestinationId) { saveState = true }; launchSingleTop = true; restoreState = true } },
                    icon = { Icon(Icons.Filled.Search, contentDescription = "Search", modifier = Modifier.size(30.dp)) },
                    label = { Text("Search", style = MaterialTheme.typography.labelLarge) },
                    colors = itemColors,
                )
                NavigationBarItem(
                    selected = currentRoute == ROUTE_LIBRARY,
                    onClick = { nav.navigate(ROUTE_LIBRARY) { popUpTo(nav.graph.startDestinationId) { saveState = true }; launchSingleTop = true; restoreState = true } },
                    icon = { Icon(Icons.Filled.LibraryMusic, contentDescription = "Library", modifier = Modifier.size(30.dp)) },
                    label = { Text("Library", style = MaterialTheme.typography.labelLarge) },
                    colors = itemColors,
                )
                NavigationBarItem(
                    selected = currentRoute == ROUTE_SETTINGS || currentRoute == ROUTE_EQ,
                    onClick = { nav.navigate(ROUTE_SETTINGS) { popUpTo(nav.graph.startDestinationId) { saveState = true }; launchSingleTop = true; restoreState = true } },
                    icon = { Icon(Icons.Filled.Settings, contentDescription = "Settings", modifier = Modifier.size(30.dp)) },
                    label = { Text("Settings", style = MaterialTheme.typography.labelLarge) },
                    colors = itemColors,
                )
            }
        }

        SnackbarHost(
            hostState = snackbar,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 150.dp),
        )
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
            onDownload = {
                actionTrack = null
                scope.launch {
                    snackbar.showSnackbar("Downloading ${track.title}…")
                    val result = app.chordless.music.download.Downloader.download(ctx, track)
                    snackbar.showSnackbar(
                        if (result.status == app.chordless.music.download.Downloader.Status.COMPLETED) {
                            "Downloaded ${track.title}"
                        } else {
                            "Download failed: ${result.error}"
                        }
                    )
                }
            },
        )
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
    onDownload: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState()) {
        Column(modifier = Modifier.padding(24.dp)) {
            Text(track.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, maxLines = 1)
            Text(track.artist, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(20.dp))
            ActionRow("Play next", onPlayNext)
            ActionRow("Add to queue", onAddToQueue)
            ActionRow("Like / Unlike", onToggleFavorite)
            ActionRow("Add to playlist", onAddToPlaylist)
            ActionRow("Download for offline", onDownload)
            Spacer(Modifier.height(16.dp))
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    }
}

@Composable
private fun ActionRow(label: String, onClick: () -> Unit) {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
    }
}
