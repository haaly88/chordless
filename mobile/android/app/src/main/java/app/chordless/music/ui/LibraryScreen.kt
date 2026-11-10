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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material.icons.Icons
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.LocalStore
import app.chordless.music.data.LocalStore.Playlist
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import kotlinx.coroutines.launch

@Composable
fun LibraryScreen(
    onPlay: (Track, List<Track>) -> Unit,
    onTrackAction: (Track) -> Unit,
) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var playlists by remember { mutableStateOf<List<Playlist>>(emptyList()) }
    var favorites by remember { mutableStateOf<List<Track>>(emptyList()) }
    var history by remember { mutableStateOf<Map<String, LocalStore.HistoryEntry>>(emptyMap()) }
    var openPlaylist by remember { mutableStateOf<Playlist?>(null) }
    var smart by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var renameTarget by remember { mutableStateOf<Playlist?>(null) }
    var deleteTarget by remember { mutableStateOf<Playlist?>(null) }
    var loaded by remember { mutableStateOf(false) }

    suspend fun refresh() {
        playlists = LocalStore.playlists(ctx)
        favorites = LocalStore.favorites(ctx)
        history = LocalStore.history(ctx)
        loaded = true
    }

    LaunchedEffect(Unit) { refresh() }
    // refresh after external playback changes (history/favorites are written on play)
    val currentTrack by PlayerManager.current.collectAsState()
    val currentId = currentTrack?.id
    LaunchedEffect(currentId) {
        if (loaded) refresh()
    }

    val smartTracks: List<Track> = when (smart) {
        "favorites" -> favorites
        "recent" -> history.values.sortedByDescending { it.lastPlayed }.map { it.track }
        "played" -> history.values.sortedByDescending { it.count }.map { it.track }
        "rated" -> history.values.sortedWith(
            compareByDescending<LocalStore.HistoryEntry> { it.count }.thenByDescending { it.lastPlayed }
        ).map { it.track }
        else -> emptyList()
    }

    AuroraBackground {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background.copy(alpha = 0f),
            floatingActionButton = {
                FloatingActionButton(
                    onClick = { showCreate = true },
                    containerColor = MaterialTheme.colorScheme.primary,
                ) {
                    Icon(Icons.Filled.Add, contentDescription = "New playlist", tint = MaterialTheme.colorScheme.onPrimary)
                }
            },
        ) { padding ->
            if (!loaded) {
                LoadingBox()
                return@Scaffold
            }
            when {
                openPlaylist != null -> {
                    PlaylistDetail(
                        playlist = openPlaylist!!,
                        onBack = { openPlaylist = null },
                        onPlay = onPlay,
                        onTrackAction = onTrackAction,
                        onRemove = { track ->
                            val pid = openPlaylist?.id
                            if (pid != null) scope.launch {
                                LocalStore.removeFromPlaylist(ctx, pid, track.id)
                                refresh()
                                openPlaylist = playlists.firstOrNull { it.id == pid }
                            }
                        },
                    )
                }
                smart != null -> {
                    SmartList(
                        title = when (smart) {
                            "favorites" -> "Favorites"
                            "recent" -> "Recently Added"
                            "played" -> "Most Played"
                            else -> "Top Rated"
                        },
                        tracks = smartTracks,
                        onBack = { smart = null },
                        onPlay = onPlay,
                        onTrackAction = onTrackAction,
                    )
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(bottom = 88.dp),
                    ) {
                        item {
                            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 20.dp)) {
                                Text("Library", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.W900)
                                Text(
                                    "${playlists.size} playlists · ${favorites.size} favorites · ${history.size} played",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            StatsRow(history = history)
                        }
                        item {
                            SectionHeader(title = "Smart playlists", modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp))
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(16.dp),
                                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
                            ) {
                                item {
                                    CoverCard(
                                        title = "Favorites",
                                        subtitle = "${favorites.size} tracks",
                                        image = favorites.firstOrNull()?.thumbnail.orEmpty(),
                                        onClick = { smart = "favorites" },
                                        size = 152.dp,
                                    )
                                }
                                item {
                                    CoverCard(
                                        title = "Recently Added",
                                        subtitle = "${history.values.size} tracks",
                                        image = history.values.maxByOrNull { it.lastPlayed }?.track?.thumbnail.orEmpty(),
                                        onClick = { smart = "recent" },
                                        size = 152.dp,
                                    )
                                }
                                item {
                                    CoverCard(
                                        title = "Most Played",
                                        subtitle = "Top repeats",
                                        image = history.values.maxByOrNull { it.count }?.track?.thumbnail.orEmpty(),
                                        onClick = { smart = "played" },
                                        size = 152.dp,
                                    )
                                }
                            }
                            if (smart == "favorites") { /* handled below via smart variable */ }
                        }
                        item {
                            SectionHeader(
                                title = "Playlists",
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
                            )
                        }
                        if (playlists.isEmpty()) {
                            item {
                                EmptyState("No playlists yet", "Tap + to create your first playlist.")
                            }
                        }
                        items(playlists) { p ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable { openPlaylist = p }
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(14.dp),
                            ) {
                                Artwork(LocalStore.collageUrl(p), size = 56.dp, radius = 14.dp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(p.name, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        "${p.tracks.size} tracks",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                IconButton(onClick = { renameTarget = p }) {
                                    Icon(Icons.Filled.Edit, contentDescription = "Rename")
                                }
                                IconButton(onClick = { p.tracks.firstOrNull()?.let { onPlay(it, p.tracks) } }) {
                                    Icon(Icons.Filled.PlayArrow, contentDescription = "Play", tint = MaterialTheme.colorScheme.primary)
                                }
                                TextButton(onClick = { deleteTarget = p }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
                            }
                        }
                        if (favorites.isNotEmpty()) {
                            item {
                                SectionHeader(title = "Favorites", modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp))
                                val favList = favorites
                                Column(modifier = Modifier.padding(horizontal = 8.dp)) {
                                    favList.take(5).forEach { t ->
                                        TrackRow(track = t, onClick = { onPlay(t, favList) }, onLongClick = { onTrackAction(t) })
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreate) {
        NamePromptDialog(
            title = "New playlist",
            onConfirm = { name ->
                scope.launch {
                    LocalStore.createPlaylist(ctx, name)
                    refresh()
                }
                showCreate = false
            },
            onDismiss = { showCreate = false },
        )
    }
    renameTarget?.let { target ->
        NamePromptDialog(
            title = "Rename playlist",
            initial = target.name,
            onConfirm = { name ->
                scope.launch {
                    LocalStore.renamePlaylist(ctx, target.id, name)
                    refresh()
                }
                renameTarget = null
            },
            onDismiss = { renameTarget = null },
        )
    }
    deleteTarget?.let { target ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Delete playlist?") },
            text = { Text("\"${target.name}\" will be deleted.") },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        LocalStore.deletePlaylist(ctx, target.id)
                        refresh()
                    }
                    deleteTarget = null
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun StatsRow(history: Map<String, LocalStore.HistoryEntry>) {
    val total = history.values.sumOf { it.count }
    val artists = history.values
        .groupBy { it.track.artist.ifBlank { "Unknown" } }
        .mapValues { (_, list) -> list.sumOf { e -> e.count } }
        .entries
        .maxByOrNull { it.value }
    Row(
        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        listOf(
            "Plays" to total.toString(),
            "Tracks" to history.size.toString(),
            "Top artist" to (artists?.key ?: "—"),
        ).forEach { (label, value) ->
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(18.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, maxLines = 1)
                Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun PlaylistDetail(
    playlist: Playlist,
    onBack: () -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
    onTrackAction: (Track) -> Unit,
    onRemove: (Track) -> Unit,
) {
    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Row(
                modifier = Modifier.padding(20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(18.dp),
            ) {
                Artwork(LocalStore.collageUrl(playlist), size = 152.dp, radius = 24.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text("PLAYLIST", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                    Text(playlist.name, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        "${playlist.tracks.size} tracks",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { playlist.tracks.firstOrNull()?.let { onPlay(it, playlist.tracks) } },
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                            shape = CircleShape,
                        ) {
                            Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
                            Text("Play all", color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.SemiBold)
                        }
                        TextButton(onClick = onBack) { Text("Back") }
                    }
                }
            }
        }
        itemsIndexed(playlist.tracks) { i, t ->
            androidx.compose.foundation.layout.Box(modifier = Modifier.padding(horizontal = 8.dp)) {
                TrackRow(
                    track = t,
                    index = i,
                    onClick = { onPlay(t, playlist.tracks) },
                    onLongClick = { onTrackAction(t) },
                    isFavorite = false,
                    onToggleFavorite = { onRemove(t) },
                )
            }
        }
    }
}

@Composable
private fun SmartList(
    title: String,
    tracks: List<Track>,
    onBack: () -> Unit,
    onPlay: (Track, List<Track>) -> Unit,
    onTrackAction: (Track) -> Unit,
) {
    LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Row(
                modifier = Modifier.padding(20.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TextButton(onClick = onBack) { Text("Back") }
            }
        }
        if (tracks.isEmpty()) {
            item { EmptyState("Nothing here yet", "Play some music to fill this list.") }
        }
        itemsIndexed(tracks) { i, t ->
            androidx.compose.foundation.layout.Box(modifier = Modifier.padding(horizontal = 8.dp)) {
                TrackRow(track = t, index = i, onClick = { onPlay(t, tracks) }, onLongClick = { onTrackAction(t) })
            }
        }
    }
}

@Composable
private fun NamePromptDialog(
    title: String,
    initial: String = "",
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Name") },
                singleLine = true,
            )
        },
        confirmButton = {
            TextButton(onClick = { if (name.isNotBlank()) onConfirm(name.trim()) }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
