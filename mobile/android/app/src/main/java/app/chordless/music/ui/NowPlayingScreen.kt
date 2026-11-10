package app.chordless.music.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.data.LyricsRepo
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import coil.compose.AsyncImage

@Composable
fun NowPlayingScreen(
    onOpenQueue: () -> Unit,
    onShareCard: (app.chordless.music.data.Track, Long, Long) -> Unit,
) {
    val track by PlayerManager.current.collectAsState()
    val position by PlayerManager.positionMs.collectAsState()
    val isPlaying by PlayerManager.isPlaying.collectAsState()
    val loading by PlayerManager.loading.collectAsState()
    val error by PlayerManager.error.collectAsState()
    val shuffle by PlayerManager.shuffle.collectAsState()
    val repeat by PlayerManager.repeat.collectAsState()
    val speed by PlayerManager.speed.collectAsState()
    val sleepRemaining by PlayerManager.sleepRemainingSec.collectAsState()
    val ctx = LocalContext.current

    var favIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showLyrics by remember { mutableStateOf(false) }
    var karaoke by remember { mutableStateOf(false) }
    var translating by remember { mutableStateOf(false) }
    var langTarget by remember { mutableStateOf("id") }
    var volume by remember { mutableStateOf(1f) }
    val scope = rememberCoroutineScope()

    val t = track
    androidx.compose.runtime.LaunchedEffect(t?.id ?: "") {
        favIds = app.chordless.music.data.Prefs.favorites(ctx).map { it.id }.toSet()
    }

    val syncedLines = remember(track) {
        (track != null && track.lyrics?.isNotBlank() ?: false) ?
            app.chordless.music.data.LyricsRepo.get(track.artist, track.title, track.album, track.duration.toInt()).synced :
            ""
    }.let { LyricsRepo.parseLrc(it) }

    val palette = rememberArtworkColors(t?.thumbnail ?: "")

    val activeIdx = remember(syncedLines, position) {
        syncedLines.indexOfLast { it.first <= position }.coerceAtLeast(0)
    }
    val activeLine = syncedLines.getOrNull(activeIdx)?.second.orEmpty()

    // --- Full-bleed artwork background ---
    Box(
        modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(
                listOf(
                    palette?.dominant?.copy(alpha = 0.55f) ?: MaterialTheme.colorScheme.primary.copy(alpha = 0.55f),
                    Color.Transparent,
                    MaterialTheme.colorScheme.background,
                )
            )
        )
    ) {
        if (t?.thumbnail?.isNotBlank() == true) {
            AsyncImage(
                model = t.thumbnail,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.content.ContentScale.Crop,
                alpha = 0.35f,
            )
        }
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(
                        palette?.dominant?.copy(alpha = 0.15f) ?: MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                        MaterialTheme.colorScheme.background.copy(alpha = 0.90f),
                    )
                )
            )
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 32.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(24.dp))

        // --- Cover art ---
        Box(contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(340.dp)
                    .clip(RoundedCornerShape(34.dp))
                    .background(
                        Brush.radialGradient(
                            0.5f to (palette?.dominant ?: MaterialTheme.colorScheme.primary).copy(alpha = 0.50f),
                            1f to Color.Transparent,
                        )
                    )
            )
            AsyncImage(
                model = t?.thumbnail,
                contentDescription = null,
                modifier = Modifier.size(300.dp).clip(RoundedCornerShape(30.dp)),
                contentScale = ContentScale.Crop,
            )
        }
        Spacer(Modifier.height(30.dp))

        if (t == null) {
            Text("Nothing playing", color = MaterialTheme.colorScheme.onSurfaceVariant)
            return
        }

        // --- Title ---
        MarqueeText(
            text = t.title,
            style = MaterialTheme.typography.headlineSmall.copy(
                fontSize = 30.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.W800,
                letterSpacing = (-0.5f).sp,
            ),
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(4.dp))

        // --- Artist / Album ---
        Text(
            listOf(t.artist, t.album).filter { !it.isNullOrBlank() }.joinToString(" • "),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(12.dp))

        // --- Now playing line ---
        if (activeLine.isNotBlank()) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(percent = 50))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.70f))
                    .clickable { showLyrics = true }
                    .padding(horizontal = 18.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
                Text(
                    activeLine.take(70),
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
        } else if (loading) {
            Text("Loading…", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Stats
        Text(
            PlayerManager.statsLine(),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(Modifier.height(20.dp))

        // --- Progress slider ---
        val dur = PlayerManager.durationMs()
        Slider(
            value = position.toFloat(),
            onValueChange = { PlayerManager.seekTo(it.toLong()) },
            valueRange = 0f..dur.coerceAtLeast(1).toFloat(),
            colors = androidx.compose.material3.SliderDefaults.colors(
                activeTrackColor = MaterialTheme.colorScheme.primary,
                thumbColor = MaterialTheme.colorScheme.primary,
                inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(fmtMs(position), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(fmtMs(dur), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        Spacer(Modifier.height(8.dp))

        // --- Controls row ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { PlayerManager.setShuffle(!shuffle) }) {
                Icon(Icons.Filled.Shuffle, contentDescription = "Shuffle",
                    tint = if (shuffle) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { PlayerManager.prev() }) {
                Icon(Icons.Filled.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(48.dp))
            }
            Button(
                onClick = { PlayerManager.toggle() },
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                ),
                shape = CircleShape,
                modifier = Modifier.size(84.dp),
            ) {
                Icon(
                    if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(40.dp),
                )
            }
            IconButton(onClick = { PlayerManager.next() }) {
                Icon(Icons.Filled.SkipNext, contentDescription = "Next", modifier = Modifier.size(48.dp))
            }
            IconButton(onClick = { PlayerManager.setRepeat((repeat + 1) % 3) }) {
                Icon(
                    if (repeat == 2) Icons.Filled.RepeatOne else Icons.Filled.Repeat,
                    contentDescription = "Repeat",
                    tint = if (repeat != 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // --- Secondary actions ---
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = {
                scope.launch {
                    val nowFav = t.id !in favIds
                    app.chordless.music.data.LocalStore.setFavorite(ctx, t, nowFav)
                    favIds = app.chordless.music.data.Prefs.favorites(ctx).map { it.id }.toSet()
                }
            }) {
                Icon(
                    if (t.id in favIds) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = "Like",
                    tint = if (t.id in favIds) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onOpenQueue) {
                Icon(Icons.Filled.QueueMusic, contentDescription = "Queue", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = {
                val speeds = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)
                val next = speeds[(speeds.indexOf(speed) + 1) % speeds.size]
                PlayerManager.setSpeed(next)
            }) {
                Text(
                    formatSpeed(speed),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { showLyrics = !showLyrics }) {
                Icon(Icons.Filled.Translate, contentDescription = "Lyrics",
                    tint = if (showLyrics) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { onShareCard(t, position, dur) }) {
                Icon(Icons.Filled.Share, contentDescription = "Share card", tint = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (sleepRemaining != null || PlayerManager.sleepEndsAt.value != null) {
                TextButton(onClick = { PlayerManager.setSleep(null) }) {
                    Text("Sleep ${PlayerManager.sleepChip() ?: ""}")
                }
            }
        }

        // --- Volume ---
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(Icons.Filled.VolumeUp, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
            Slider(
                value = volume,
                onValueChange = { volume = it; PlayerManager.setVolume(it) },
                colors = SliderDefaults.colors(
                    activeTrackColor = MaterialTheme.colorScheme.primary,
                    thumbColor = MaterialTheme.colorScheme.primary,
                ),
                modifier = Modifier.weight(1f),
            )
        }

        // --- Lyrics overlay ---
        if (showLyrics) {
            Spacer(Modifier.height(16.dp))
            NowPlayingLyrics(
                track = t,
                showLyrics = showLyrics,
                karaoke = karaoke,
                translating = translating,
                langTarget = langTarget,
                onSeek = { PlayerManager.seekTo(it) },
                onCloseLyrics = { showLyrics = false },
                onToggleKaraoke = { karaoke = it },
                onTranslate = {
                    translating = true
                    scope.launch {
                        val source = track?.lyrics?.plain ?: track?.lyrics?.synced ?: ""
                        if (source.isNotBlank()) {
                            // TODO: call TranslateRepo
                        }
                    }
                },
            )
        }
    }
}

private fun formatSpeed(v: Float): String =
    if (v == v.toInt().toFloat()) "${v.toInt()}x" else "${v}x"

private fun fmtMs(ms: Long): String {
    val s = (ms / 1000).toInt().coerceAtLeast(0)
    return "%d:%02d".format(s / 60, s % 60)
}
