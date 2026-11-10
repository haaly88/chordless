package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.data.LocalStore
import app.chordless.music.data.LyricsRepo
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import coil.compose.AsyncImage
import kotlinx.coroutines.launch

@Composable
fun NowPlayingScreen(
    onOpenQueue: () -> Unit,
    onShareCard: (Track, Long, Long) -> Unit,
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
    val scope = rememberCoroutineScope()

    var favIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var showLyrics by remember { mutableStateOf(false) }
    var karaoke by remember { mutableStateOf(false) }
    var translating by remember { mutableStateOf(false) }
    var langTarget by remember { mutableStateOf("id") }
    var volume by remember { mutableStateOf(1f) }

    val t = track
    LaunchedEffect(t?.id ?: "") {
        favIds = Prefs.favorites(ctx).map { it.id }.toSet()
    }

    var syncedRaw by remember(t?.id) { mutableStateOf("") }
    LaunchedEffect(t?.id) {
        val tr = t
        syncedRaw = if (tr == null) "" else LyricsRepo.get(
            tr.artist,
            tr.title,
            tr.album,
            tr.duration.toInt(),
        ).synced
    }

    val syncedLines = remember(syncedRaw) { LyricsRepo.parseLrc(syncedRaw) }

    val palette = rememberArtworkColors(t?.thumbnail ?: "")

    val activeIdx = remember(syncedLines, position) {
        syncedLines.indexOfLast { it.first <= position }.coerceAtLeast(0)
    }
    val activeLine = syncedLines.getOrNull(activeIdx)?.second.orEmpty()

    // --- Full-bleed artwork backdrop with palette wash ---
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        (palette?.dominant ?: MaterialTheme.colorScheme.primary).copy(alpha = 0.45f),
                        MaterialTheme.colorScheme.background,
                    )
                )
            )
    ) {
        if (!t?.thumbnail.isNullOrBlank()) {
            AsyncImage(
                model = t?.thumbnail,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                alpha = 0.28f,
            )
        }
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            Color.Transparent,
                            MaterialTheme.colorScheme.background.copy(alpha = 0.92f),
                        )
                    )
                )
        )
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 26.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(20.dp))

        NowPlayingHeader(track = t, palette = palette)

        Spacer(Modifier.height(18.dp))

        if (t == null) {
            Text(
                "Nothing playing",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        } else {
            // --- Now playing lyric line ---
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
                    Box(
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                    )
                    Text(
                        activeLine.take(70),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(10.dp))
            }

            if (error != null) {
                Text(
                    error!!,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else if (loading) {
                Text(
                    "Loading…",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Text(
                PlayerManager.statsLine(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(16.dp))

            // --- Progress ---
            val dur = PlayerManager.durationMs()
            Slider(
                value = position.toFloat().coerceIn(0f, dur.coerceAtLeast(1).toFloat()),
                onValueChange = { PlayerManager.seekTo(it.toLong()) },
                valueRange = 0f..dur.coerceAtLeast(1).toFloat(),
                colors = SliderDefaults.colors(
                    activeTrackColor = MaterialTheme.colorScheme.primary,
                    thumbColor = MaterialTheme.colorScheme.primary,
                    inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    fmtMs(position),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    fmtMs(dur),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(10.dp))

            // --- Transport controls ---
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { PlayerManager.setShuffle(!shuffle) }) {
                    Icon(
                        Icons.Filled.Shuffle,
                        contentDescription = "Shuffle",
                        tint = if (shuffle) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { PlayerManager.prev() }) {
                    Icon(
                        Icons.Filled.SkipPrevious,
                        contentDescription = "Previous",
                        modifier = Modifier.size(44.dp),
                        tint = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Button(
                    onClick = { PlayerManager.toggle() },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    shape = CircleShape,
                    modifier = Modifier.size(78.dp),
                ) {
                    Icon(
                        if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(38.dp),
                    )
                }
                IconButton(onClick = { PlayerManager.next() }) {
                    Icon(
                        Icons.Filled.SkipNext,
                        contentDescription = "Next",
                        modifier = Modifier.size(44.dp),
                        tint = MaterialTheme.colorScheme.onSurface,
                    )
                }
                IconButton(onClick = { PlayerManager.setRepeat((repeat + 1) % 3) }) {
                    Icon(
                        if (repeat == 2) Icons.Filled.RepeatOne else Icons.Filled.Repeat,
                        contentDescription = "Repeat",
                        tint = if (repeat != 0) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
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
                        LocalStore.setFavorite(ctx, t, nowFav)
                        favIds = Prefs.favorites(ctx).map { it.id }.toSet()
                    }
                }) {
                    Icon(
                        if (t.id in favIds) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "Like",
                        tint = if (t.id in favIds) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = onOpenQueue) {
                    Icon(
                        Icons.Filled.QueueMusic,
                        contentDescription = "Queue",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
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
                    Icon(
                        Icons.Filled.Translate,
                        contentDescription = "Lyrics",
                        tint = if (showLyrics) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { onShareCard(t, position, dur) }) {
                    Icon(
                        Icons.Filled.Share,
                        contentDescription = "Share card",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (sleepRemaining != null || PlayerManager.sleepEndsAt.value != null) {
                    TextButton(onClick = { PlayerManager.setSleep(null) }) {
                        Text("Sleep ${PlayerManager.sleepChip() ?: ""}")
                    }
                }
            }

            // --- Volume ---
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(
                    Icons.Filled.VolumeUp,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(22.dp),
                )
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

            // --- Lyrics panel ---
            if (showLyrics) {
                Spacer(Modifier.height(14.dp))
                NowPlayingLyrics(
                    track = t,
                    showLyrics = showLyrics,
                    karaoke = karaoke,
                    translating = translating,
                    langTarget = langTarget,
                    onSeek = { PlayerManager.seekTo(it) },
                    onCloseLyrics = { showLyrics = false },
                    onToggleKaraoke = { karaoke = it },
                    onTranslate = { translating = !translating },
                )
            }
        }

        Spacer(Modifier.height(40.dp))
    }
}

private fun formatSpeed(v: Float): String =
    if (v == v.toInt().toFloat()) "${v.toInt()}x" else "${v}x"

private fun fmtMs(ms: Long): String {
    val s = (ms / 1000).toInt().coerceAtLeast(0)
    return "%d:%02d".format(s / 60, s % 60)
}
