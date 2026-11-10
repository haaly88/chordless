package app.chordless.music.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.Manifest
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.Icons
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Innertube
import app.chordless.music.data.LocalStore
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SearchScreen(
    onPlay: (Track, List<Track>) -> Unit,
    onOpenArtist: (Track) -> Unit,
    onOpenAlbum: (Track) -> Unit,
    onTrackAction: (Track) -> Unit,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Track>>(emptyList()) }
    var recents by remember { mutableStateOf<List<String>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableStateOf(0) }
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }

    LaunchedEffect(Unit) {
        gl = Prefs.gl(ctx)
        hl = Prefs.hl(ctx)
        recents = LocalStore.searchHistory(ctx)
    }

    LaunchedEffect(query, retry) {
        if (query.length < 2) {
            results = emptyList()
            loading = false
            return@LaunchedEffect
        }
        loading = true
        delay(450)
        try {
            results = Innertube.search(query, 40, gl, hl)
            error = null
            scope.launch { LocalStore.pushSearch(ctx, query); recents = LocalStore.searchHistory(ctx) }
        } catch (e: Exception) {
            error = e.message
        }
        loading = false
    }

    val micLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val matches = result.data
            ?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
        if (!matches.isNullOrEmpty()) query = matches[0]
    }
    val audioPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) launchVoiceSearch(micLauncher)
    }

    AuroraBackground {
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background.copy(alpha = 0f),
            floatingActionButton = {
                FloatingActionButton(
                    onClick = {
                        if (ctx.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            launchVoiceSearch(micLauncher)
                        } else {
                            audioPermission.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                    containerColor = MaterialTheme.colorScheme.primary,
                ) {
                    Icon(Icons.Filled.Mic, contentDescription = "Voice search", tint = MaterialTheme.colorScheme.onPrimary)
                }
            },
        ) { padding ->
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Chordless.gutter, vertical = 14.dp)
                        .heightIn(min = 56.dp),
                    shape = CircleShape,
                    colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.75f),
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedBorderColor = androidx.compose.ui.graphics.Color.Transparent,
                    ),
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    trailingIcon = {
                        if (query.isNotEmpty()) {
                            IconButton(onClick = { query = "" }) {
                                Icon(Icons.Filled.Close, contentDescription = "Clear")
                            }
                        }
                    },
                    placeholder = { Text("Search songs, videos, albums, artists…") },
                    singleLine = true,
                )
                when {
                    loading && results.isEmpty() -> LoadingBox()
                    error != null && results.isEmpty() -> ErrorBox(error ?: "Search failed") { retry++ }
                    query.length < 2 -> {
                        if (recents.isNotEmpty()) {
                            Row(
                                modifier = Modifier.padding(horizontal = 16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("Recent searches", style = MaterialTheme.typography.titleSmall)
                                TextButton(onClick = {
                                    scope.launch {
                                        LocalStore.clearSearch(ctx)
                                        recents = emptyList()
                                    }
                                }) { Text("Clear") }
                            }
                            LazyRow(
                                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                items(recents) { r ->
                                    androidx.compose.foundation.layout.Box(
                                        modifier = Modifier
                                            .clip(androidx.compose.foundation.shape.RoundedCornerShape(percent = 50))
                                            .clickable { query = r }
                                            .padding(horizontal = 14.dp, vertical = 8.dp),
                                    ) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Text(r)
                                            Icon(
                                                Icons.Filled.Close,
                                                contentDescription = "Remove",
                                                modifier = Modifier.clickable {
                                                    scope.launch {
                                                        LocalStore.removeSearch(ctx, r)
                                                        recents = LocalStore.searchHistory(ctx)
                                                    }
                                                },
                                            )
                                        }
                                    }
                                }
                            }
                        } else {
                            EmptyState("Search", "Type to search YouTube Music — or tap the mic to speak.")
                        }
                    }
                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
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
                                    onLongClick = { onTrackAction(track) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun launchVoiceSearch(launcher: androidx.activity.result.ActivityResultLauncher<Intent>) {
    try {
        launcher.launch(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            }
        )
    } catch (e: Exception) {
        // no recognizer available — ignore
    }
}
