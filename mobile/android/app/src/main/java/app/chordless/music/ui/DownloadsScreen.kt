package app.chordless.music.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Track
import app.chordless.music.download.Downloader
import app.chordless.music.player.PlayerManager
import java.io.File

/**
 * Offline library — everything that was downloaded for listening without a
 * network connection.
 */
@Composable
fun DownloadsScreen() {
    val ctx = LocalContext.current
    var files by remember { mutableStateOf<List<File>>(emptyList()) }

    LaunchedEffect(Unit) {
        val dir = File(ctx.filesDir, "downloads")
        files = dir.listFiles()?.filter { it.isFile && !it.name.endsWith(".meta") }?.sortedByDescending { it.lastModified() }
            ?: emptyList()
    }

    AuroraBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = Chordless.gutter,
                end = Chordless.gutter,
                bottom = 210.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Spacer(Modifier.height(16.dp))
                Text(
                    "Downloads",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.W900,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Available offline",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
            }

            if (files.isEmpty()) {
                item {
                    GlassPanel(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(
                                Icons.Filled.Download,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(40.dp),
                            )
                            Spacer(Modifier.height(12.dp))
                            Text(
                                "Nothing downloaded yet",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.W700,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Use “Download for offline” from a track’s menu to keep it on the device.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            items(files) { file ->
                val track = remember(file) { Downloader.metaFor(file) }
                GlassPanel(modifier = Modifier.fillMaxWidth(), radius = Chordless.radiusM) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                val meta = track ?: Track(
                                    id = file.name,
                                    title = file.nameWithoutExtension,
                                    artist = "Unknown artist",
                                )
                                PlayerManager.playLocal(file, meta)
                            }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.PlayArrow,
                            contentDescription = "Play",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(28.dp),
                        )
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 12.dp),
                        ) {
                            Text(
                                track?.title ?: file.nameWithoutExtension,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.W700,
                                color = MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                            )
                            Text(
                                "${track?.artist ?: "Unknown artist"} · ${file.length() / 1024 / 1024} MB",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                            )
                        }
                        IconButton(onClick = {
                            Downloader.delete(file)
                            files = files.filterNot { it == file }
                        }) {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = "Delete download",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }
    }
}
