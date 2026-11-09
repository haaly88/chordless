package app.chordless.music.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueSheet(
    onDismiss: () -> Unit,
    snackbar: SnackbarHostState,
) {
    val queue by PlayerManager.queue.collectAsState()
    val index by PlayerManager.index.collectAsState()
    val current by PlayerManager.current.collectAsState()
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(index) {
        if (queue.isNotEmpty() && index in queue.indices) listState.animateScrollToItem(index)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Queue", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    "${queue.size} tracks",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TextButton(onClick = {
                val backup = queue
                PlayerManager.clearQueue()
                scope.launch {
                    val res = snackbar.showSnackbar("Queue cleared", "Undo")
                    if (res == SnackbarResult.ActionPerformed) {
                        // restore via re-add (simplified): play backup first track
                        backup.firstOrNull()?.let { PlayerManager.play(it, backup) }
                    }
                }
            }) {
                Text("Clear")
            }
        }
        if (queue.isEmpty()) {
            EmptyState("Queue is empty", "Play something and it will show up here.")
            return@ModalBottomSheet
        }
        LazyColumn(
            state = listState,
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        ) {
            itemsIndexed(queue) { i, track ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BoxRow(
                        track = track,
                        index = i,
                        isCurrent = current?.id == track.id,
                        onClick = {
                            PlayerManager.play(track, queue)
                            onDismiss()
                        },
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = { PlayerManager.removeFromQueue(i) }) {
                        Icon(Icons.Filled.Delete, contentDescription = "Remove")
                    }
                }
            }
        }
        Row(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    }
}

@Composable
private fun BoxRow(
    track: Track,
    index: Int,
    isCurrent: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    androidx.compose.foundation.layout.Box(modifier = modifier) {
        TrackRow(
            track = track,
            onClick = onClick,
            index = index,
            isCurrent = isCurrent,
        )
    }
}
