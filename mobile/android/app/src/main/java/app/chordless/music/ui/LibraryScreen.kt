package app.chordless.music.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track
import kotlinx.coroutines.launch

/** Local favorites (DataStore). Tap a favorite to play it on its own. */
@Composable
fun LibraryScreen(onPlay: (Track) -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var favIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var loaded by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        favIds = Prefs.favorites(ctx)
        loaded = true
    }

    if (!loaded) {
        LoadingBox()
        return
    }
    if (favIds.isEmpty()) {
        Column(modifier = Modifier.paddingDp()) {
            Text("No favorites yet", style = MaterialTheme.typography.titleMedium)
            Text("Tap the heart on any song to save it here.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    LazyColumn(contentPadding = PaddingValues(16.dp)) {
        item {
            Text("Favorites (${favIds.size})", style = MaterialTheme.typography.titleLarge)
        }
        items(favIds.toList()) { id ->
            TrackRow(
                track = Track(id = id, title = "Saved track", artist = "", thumbnail = ""),
                onClick = { onPlay(Track(id = id, title = "Saved track")) },
                isFavorite = true,
                onToggleFavorite = {
                    scope.launch {
                        Prefs.setFavorite(ctx, id, false)
                        favIds = Prefs.favorites(ctx)
                    }
                },
            )
        }
    }
}

private fun Modifier.paddingDp() = this.then(
    androidx.compose.foundation.layout.padding(16.dp)
)
