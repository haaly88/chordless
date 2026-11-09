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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.filled.Share
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
import app.chordless.music.data.TranslateRepo
import app.chordless.music.player.PlayerManager
import coil.compose.AsyncImage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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
    var lyrics by remember { mutableStateOf<LyricsRepo.Lyrics?>(null) }
    var lyricsLoading by remember { mutableStateOf(false) }
    var showLyrics by remember { mutableStateOf(false) }
    var karaoke by remember { mutableStateOf(false) }
    var translating by remember { mutableStateOf(false) }
    var translated by remember { mutableStateOf<String?>(null) }
    var langTarget by remember { mutableStateOf("id") }
    var volume by remember { mutableStateOf(1f) }
    val scope = rememberCoroutineScope()

    val t = track
    if (t != null) {
        androidx.compose.runtime.LaunchedEffect(t.id) {
            favIds = LocalStore.favorites(ctx).map { it.id }.toSet()
            translated = null
            lyricsLoading = true
            lyrics = try {
                LyricsRepo.get(t.artist, t.title, t.album, t.duration.toInt())
            } catch (e: Exception) {
                LyricsRepo.Lyrics()
            }
            lyricsLoading = false
        }
    }

    val syncedLines = remember(lyrics) {
        (lyrics?.synced ?: "").let { if (it.isNotBlank()) LyricsRepo.parseLrc(it) else emptyList() }
    }
    val activeIdx = remember(syncedLines, position) {
        syncedLines.indexOfLast { it.first <= position }.coerceAtLeast(0)
    }
    val activeLine = syncedLines.getOrNull(activeIdx)?.second.orEmpty()

    if (karaoke) {
        KaraokeView(
            lines = syncedLines,
            activeIdx = activeIdx,
            onSeek = { PlayerManager.seekTo(it) },
            onClose = { karaoke = false },
        )
        return
    }

    Box(
        modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(
                listOf(
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.20f),
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
                contentScale = ContentScale.Crop,
                alpha = 0.28f,
            )
        }
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.verticalGradient(
                    listOf(
                        MaterialTheme.colorScheme.background.copy(alpha = 0.35f),
                        MaterialTheme.colorScheme.background.copy(alpha = 0.85f),
                    )
                )
            )
        )
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(16.dp))
            if (t == null) {
                Text("Nothing playing", color = MaterialTheme.colorScheme.onSurfaceVariant)
                return@Column
            }
            Box(contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier.size(340.dp).clip(CircleShape).background(
                        Brush.radialGradient(
                            0.5f to MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
                            1f to Color.Transparent,
                        )
                    )
                )
                AsyncImage(
                    model = t.thumbnail,
                    contentDescription = null,
                    modifier = Modifier.size(300.dp).shadow(32.dp, RoundedCornerShape(28.dp)).clip(RoundedCornerShape(28.dp)),
                    contentScale = ContentScale.Crop,
                )
            }
            Spacer(Modifier.height(26.dp))
            MarqueeText(
                text = t.title,
                style = MaterialTheme.typography.headlineSmall.copy(fontSize = 26.sp, fontWeight = FontWeight.Bold),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(4.dp))
            Text(
                listOf(t.artist, t.album).filter { !it.isNullOrBlank() }.joinToString(" • "),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (activeLine.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(percent = 50))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f))
                        .clickable { showLyrics = true }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Box(Modifier.size(7.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
                    Text(
                        activeLine.take(60),
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
            // stats for nerds (BitChord parity)
            Text(
                PlayerManager.statsLine(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(16.dp))
            val dur = PlayerManager.durationMs()
            Slider(
                value = position.toFloat(),
                onValueChange = { PlayerManager.seekTo(it.toLong()) },
                valueRange = 0f..dur.coerceAtLeast(1).toFloat(),
                colors = SliderDefaults.colors(
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

            Spacer(Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { PlayerManager.setShuffle(!shuffle) }) {
                    Icon(
                        Icons.Filled.Shuffle,
                        contentDescription = "Shuffle",
                        tint = if (shuffle) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { PlayerManager.prev() }) {
                    Icon(Icons.Filled.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(44.dp))
                }
                Button(
                    onClick = { PlayerManager.toggle() },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    shape = CircleShape,
                    modifier = Modifier.size(80.dp),
                ) {
                    Icon(
                        if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(38.dp),
                    )
                }
                IconButton(onClick = { PlayerManager.next() }) {
                    Icon(Icons.Filled.SkipNext, contentDescription = "Next", modifier = Modifier.size(44.dp))
                }
                IconButton(onClick = { PlayerManager.setRepeat((repeat + 1) % 3) }) {
                    Icon(
                        if (repeat == 2) Icons.Filled.RepeatOne else Icons.Filled.Repeat,
                        contentDescription = "Repeat",
                        tint = if (repeat != 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

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
                    Icon(Icons.Filled.Translate, contentDescription = "Lyrics", tint = if (showLyrics) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
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

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(Icons.Filled.VolumeUp, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp))
                Slider(
                    value = volume,
                    onValueChange = {
                        volume = it
                        PlayerManager.setVolume(it)
                    },
                    colors = SliderDefaults.colors(
                        activeTrackColor = MaterialTheme.colorScheme.primary,
                        thumbColor = MaterialTheme.colorScheme.primary,
                    ),
                    modifier = Modifier.weight(1f),
                )
            }

            if (showLyrics) {
                Spacer(Modifier.height(12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("id" to "ID", "en" to "EN").forEach { (code, label) ->
                        androidx.compose.foundation.layout.Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(percent = 50))
                                .background(
                                    if (langTarget == code) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.surfaceVariant
                                )
                                .clickable { langTarget = code }
                                .padding(horizontal = 14.dp, vertical = 6.dp),
                        ) {
                            Text(
                                label,
                                color = if (langTarget == code) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                style = MaterialTheme.typography.labelMedium,
                            )
                        }
                    }
                    TextButton(onClick = {
                        if (syncedLines.isNotEmpty()) karaoke = true
                        else scope.launch {
                            translating = true
                            try {
                                val source = lyrics?.plain ?: lyrics?.synced ?: ""
                                if (source.isNotBlank()) {
                                    translated = TranslateRepo.translate(source, langTarget)
                                }
                            } catch (e: Exception) {
                                // keep original lyrics on translation failure
                            } finally {
                                translating = false
                            }
                        }
                    }) {
                        Text(if (syncedLines.isNotEmpty()) "Karaoke" else if (translating) "Translating…" else "Translate")
                    }
                }
                if (lyricsLoading) {
                    Text("Loading lyrics…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                } else if (syncedLines.isNotEmpty()) {
                    syncedLines.forEachIndexed { i, (time, text) ->
                        Text(
                            text,
                            color = if (i == activeIdx) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                            style = if (i == activeIdx) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
                            fontWeight = if (i == activeIdx) FontWeight.SemiBold else FontWeight.Normal,
                            modifier = Modifier.clickable { PlayerManager.seekTo(time) },
                        )
                    }
                } else if (translated != null) {
                    Text(translated!!)
                } else if (lyrics?.plain?.isNotBlank() == true) {
                    Text(lyrics!!.plain)
                } else {
                    Text("No lyrics found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

private fun formatSpeed(v: Float): String =
    if (v == v.toInt().toFloat()) "${v.toInt()}x" else "${v}x"

@Composable
private fun KaraokeView(
    lines: List<Pair<Long, String>>,
    activeIdx: Int,
    onSeek: (Long) -> Unit,
    onClose: () -> Unit,
) {
    androidx.compose.foundation.layout.Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                IconButton(onClick = onClose) {
                    Icon(Icons.Filled.Close, contentDescription = "Close karaoke")
                }
            }
            Spacer(Modifier.height(24.dp))
            val line = lines.getOrNull(activeIdx)?.second.orEmpty()
            Text(
                line,
                style = MaterialTheme.typography.displaySmall.copy(fontSize = 34.sp, fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.primary,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(16.dp))
            Text(
                lines.getOrNull(activeIdx + 1)?.second.orEmpty(),
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.weight(1f))
            Text(
                "Tap a line in lyrics to seek",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
