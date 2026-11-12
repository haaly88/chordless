package app.chordless.music.ui

import androidx.compose.animation.animateColorAsState
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.data.LyricsRepo
import app.chordless.music.data.Track
import app.chordless.music.data.TranslateRepo
import app.chordless.music.player.PlayerManager

/**
 * Kinetic lyrics panel.
 *
 * Synced lines scroll automatically with the playback position, the active line
 * is highlighted (karaoke style) and tapping any line seeks to that moment.
 */
@Composable
fun NowPlayingLyrics(
    track: Track,
    showLyrics: Boolean,
    karaoke: Boolean,
    translating: Boolean,
    langTarget: String,
    onSeek: (Long) -> Unit,
    onCloseLyrics: () -> Unit,
    onToggleKaraoke: (Boolean) -> Unit,
    onTranslate: () -> Unit,
) {
    var syncedRaw by remember(track.id) { mutableStateOf("") }
    var plainText by remember(track.id) { mutableStateOf("") }
    var translated by remember(track.id) { mutableStateOf("") }
    var loading by remember(track.id) { mutableStateOf(true) }

    LaunchedEffect(track.id) {
        loading = true
        val lyrics = LyricsRepo.get(track.artist, track.title, track.album, track.duration.toInt())
        syncedRaw = lyrics.synced
        plainText = lyrics.plain
        loading = false
    }

    LaunchedEffect(translating, langTarget, track.id) {
        if (!translating) {
            translated = ""
            return@LaunchedEffect
        }
        val source = plainText.ifBlank { syncedRaw }
        if (source.isNotBlank()) {
            translated = TranslateRepo.translate(source, langTarget)
        }
    }

    val lines = remember(syncedRaw) { LyricsRepo.parseLrc(syncedRaw) }
    val position by PlayerManager.positionMs.collectAsState()

    val activeIndex = remember(lines, position) {
        if (lines.isEmpty()) -1 else lines.indexOfLast { it.first <= position }.coerceAtLeast(0)
    }

    val listState = rememberLazyListState()
    LaunchedEffect(activeIndex) {
        if (activeIndex >= 0 && lines.isNotEmpty()) {
            listState.animateScrollToItem(activeIndex.coerceAtMost(lines.lastIndex))
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 22.dp)
            .padding(top = 48.dp, bottom = 120.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Lyrics",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = { onToggleKaraoke(!karaoke) }) {
                Text(
                    "KARAOKE",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (karaoke) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { onTranslate() }) {
                Icon(
                    Icons.Filled.Translate,
                    contentDescription = "Translate",
                    tint = if (translating) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onCloseLyrics) {
                Icon(
                    Icons.Filled.Close,
                    contentDescription = "Close lyrics",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(6.dp))

        when {
            loading -> Text(
                "Loading lyrics…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            lines.isNotEmpty() -> {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    itemsIndexed(lines) { index, (timeMs, text) ->
                        LyricLine(
                            text = text,
                            active = index == activeIndex,
                            karaoke = karaoke,
                            onClick = { onSeek(timeMs) },
                        )
                    }
                }
            }

            plainText.isNotBlank() -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                ) {
                    plainText.lines().forEach { line ->
                        Text(
                            line,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    }
                }
            }

            else -> Text(
                "No lyrics found for this track.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (translated.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Text(
                "Translation",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(4.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.35f))
                    .padding(12.dp),
            ) {
                Text(
                    translated,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Start,
                )
            }
        }
    }
}

@Composable
private fun LyricLine(
    text: String,
    active: Boolean,
    karaoke: Boolean,
    onClick: () -> Unit,
) {
    val target = if (active) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
    val color by animateColorAsState(
        targetValue = target,
        label = "lyricColor",
    )
    Text(
        text = text,
        style = if (active && karaoke) {
            MaterialTheme.typography.titleMedium.copy(
                fontSize = 20.sp,
                fontWeight = FontWeight.W800,
            )
        } else {
            MaterialTheme.typography.bodyLarge.copy(
                fontSize = if (active) 19.sp else 17.sp,
                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
            )
        },
        color = if (active && karaoke) MaterialTheme.colorScheme.primary else color,
        textAlign = TextAlign.Center,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 2.dp),
    )
}
