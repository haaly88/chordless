package app.chordless.music.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.chordless.music.data.PlaylistCard
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager

private sealed interface Screen {
    data object Home : Screen
    data object Search : Screen
    data object Library : Screen
    data object Settings : Screen
    data object NowPlaying : Screen
    data class Page(val kind: String, val rawId: String) : Screen
}

@Composable
fun ChordlessApp() {
    val ctx = LocalContext.current
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        gl = app.chordless.music.data.Prefs.gl(ctx)
        hl = app.chordless.music.data.Prefs.hl(ctx)
    }

    val current by PlayerManager.current.collectAsState()
    val isPlaying by PlayerManager.isPlaying.collectAsState()
    val loading by PlayerManager.loading.collectAsState()

    fun play(track: Track, q: List<Track>) = PlayerManager.play(track, q)
    fun playSingle(track: Track) = PlayerManager.play(track)

    Scaffold(
        bottomBar = {
            Column {
                if (current != null && screen !is Screen.NowPlaying) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { screen = Screen.NowPlaying }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Artwork(current!!.thumbnail, size = 44.dp)
                        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            Text(current!!.title, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyLarge)
                            Text(current!!.artist, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (loading) {
                            Text("…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        IconButton(onClick = { PlayerManager.toggle() }) {
                            Icon(
                                if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                contentDescription = "Play/Pause",
                            )
                        }
                    }
                }
                NavigationBar {
                    NavigationBarItem(
                        selected = screen is Screen.Home,
                        onClick = { screen = Screen.Home },
                        icon = { Icon(Icons.Filled.Home, contentDescription = "Home") },
                        label = { Text("Home") },
                    )
                    NavigationBarItem(
                        selected = screen is Screen.Search,
                        onClick = { screen = Screen.Search },
                        icon = { Icon(Icons.Filled.Search, contentDescription = "Search") },
                        label = { Text("Search") },
                    )
                    NavigationBarItem(
                        selected = screen is Screen.Library,
                        onClick = { screen = Screen.Library },
                        icon = { Icon(Icons.Filled.LibraryMusic, contentDescription = "Library") },
                        label = { Text("Library") },
                    )
                    NavigationBarItem(
                        selected = screen is Screen.Settings,
                        onClick = { screen = Screen.Settings },
                        icon = { Icon(Icons.Filled.Settings, contentDescription = "Settings") },
                        label = { Text("Settings") },
                    )
                }
            }
        },
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when (val s = screen) {
                is Screen.Home -> HomeScreen(
                    onPlay = ::play,
                    onOpenPlaylist = { card: PlaylistCard -> screen = Screen.Page("playlist", card.id) },
                    gl = gl,
                    hl = hl,
                )
                is Screen.Search -> SearchScreen(
                    onPlay = ::play,
                    onOpenArtist = { track: Track -> screen = Screen.Page("artist", track.browseId ?: track.id) },
                    onOpenAlbum = { track: Track -> screen = Screen.Page("album", track.browseId ?: track.id) },
                )
                is Screen.Library -> LibraryScreen(onPlay = ::playSingle)
                is Screen.Settings -> SettingsScreen()
                is Screen.NowPlaying -> NowPlayingScreen()
                is Screen.Page -> PageScreen(kind = s.kind, rawId = s.rawId, onPlay = ::play)
            }
        }
    }
}
