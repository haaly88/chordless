package app.chordless.music.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Innertube
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track
import kotlinx.coroutines.delay

@Composable
fun SearchScreen(
    onPlay: (Track, List<Track>) -> Unit,
    onOpenArtist: (Track) -> Unit,
    onOpenAlbum: (Track) -> Unit,
) {
    val ctx = LocalContext.current
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Track>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }

    LaunchedEffect(Unit) {
        gl = Prefs.gl(ctx)
        hl = Prefs.hl(ctx)
    }

    LaunchedEffect(query) {
        if (query.length < 2) {
            results = emptyList()
            loading = false
            return@LaunchedEffect
        }
        loading = true
        delay(400) // debounce
        try {
            results = Innertube.search(query, 40, gl, hl)
            error = null
        } catch (e: Exception) {
            error = e.message
        }
        loading = false
    }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            placeholder = { Text("Search songs, videos, albums, artists…") },
            singleLine = true,
        )
        if (loading) LoadingBox()
        else if (error != null && results.isEmpty()) ErrorBox(error!!) { }
        else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            ) {
                items(results) { track ->
                    TrackRow(
                        track = track,
                        onClick = {
                            when (track.kind) {
                                "artist" -> onOpenArtist(track)
                                "album" -> onOpenAlbum(track)
                                else -> onPlay(track, results)
                            }
                        },
                    )
                }
            }
        }
    }
}
