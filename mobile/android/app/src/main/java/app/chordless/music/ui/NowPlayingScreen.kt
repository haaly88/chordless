package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.R
import app.chordless.music.data.LocalStore
import app.chordless.music.data.LyricsRepo
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
    var vibes by remember { mutableStateOf<List<ArtworkTagger.Vibe>>(emptyList()) }

    val t = track
    LaunchedEffect(t?.id ?: "") {
        favIds = LocalStore.favorites(ctx).map { it.id }.toSet()
    }

    // On-device artwork classification -> vibe tags.
    LaunchedEffect(t?.id, t?.thumbnail) {
        val url = t?.thumbnail.orEmpty()
        vibes = if (url.isBlank()) emptyList() else ArtworkTagger.tag(ctx, url)
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
    // Kept in its own composable so the position ticks do not re-render the
    // (expensive) blurred artwork on every update.
    NowPlayingBackdrop(
        track = t,
        palette = palette,
        modifier = Modifier.fillMaxSize(),
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 26.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(20.dp))

        NowPlayingHeader(track = t, palette = palette)

        if (vibes.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                vibes.forEach { vibe ->
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.16f))
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                    ) {
                        Text(
                            vibe.label,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }

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
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.95f),
                                    MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.72f),
                                )
                            )
                        )
                        .border(
                            1.dp,
                            Color.White.copy(alpha = 0.10f),
                            RoundedCornerShape(22.dp),
                        )
                        .clickable { showLyrics = true }
                        .padding(horizontal = 18.dp, vertical = 14.dp),
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                        )
                        Text(
                            activeLine,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.SemiBold,
                                lineHeight = 22.sp,
                            ),
                            color = MaterialTheme.colorScheme.onSurface,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
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
                        favIds = LocalStore.favorites(ctx).map { it.id }.toSet()
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

            // --- Lyrics overlay (full screen, drawn above everything) ---
        }

        Spacer(Modifier.height(150.dp))
    }

    if (showLyrics && t != null) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background.copy(alpha = 0.97f)),
        ) {
            NowPlayingLyrics(
                track = t,
                showLyrics = true,
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
}

private fun formatSpeed(v: Float): String =
    if (v == v.toInt().toFloat()) "${v.toInt()}x" else "${v}x"
/**
 * Immersive backdrop for the Now Playing screen: a bundled gradient artwork
 * plus the track cover, washed with the palette colour.
 */
@Composable
private fun NowPlayingBackdrop(
    track: Track?,
    palette: ArtworkPalette.Colors?,
    modifier: Modifier = Modifier,
) {
    val backdropRes = remember(track?.id) {
        val index = ((track?.id?.hashCode() ?: 0) % 8 + 8) % 8 + 1
        when (index) {
            1 -> R.drawable.backdrop_1
            2 -> R.drawable.backdrop_2
            3 -> R.drawable.backdrop_3
            4 -> R.drawable.backdrop_4
            5 -> R.drawable.backdrop_5
            6 -> R.drawable.backdrop_6
            7 -> R.drawable.backdrop_7
            else -> R.drawable.backdrop_8
        }
    }
    Box(
        modifier = modifier.background(
            Brush.verticalGradient(
                listOf(
                    (palette?.dominant ?: MaterialTheme.colorScheme.primary).copy(alpha = 0.45f),
                    MaterialTheme.colorScheme.background,
                )
            )
        )
    ) {
        Image(
            painter = painterResource(backdropRes),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            alpha = 0.55f,
        )
        if (!track?.thumbnail.isNullOrBlank()) {
            AsyncImage(
                model = track.thumbnail,
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
}
