package app.chordless.music.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Getter
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AndroidTextTools
import androidx.compose.ui.text.KeyboardActions
import androidx.compose.ui.text.SoftKeyboardController
import androidx.compose.ui.text.SoftKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import app.chordless.music.data.LyricsRepo
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collectAsState
import kotlinx.coroutines.launch

@Composable
fun NowPlayingLyrics(
    track: Track?,
    showLyrics: Boolean,
    var karaoke: Boolean,
    var translating: Boolean,
    var langTarget: String,
    onSeek: (Long) -> Unit,
    onCloseLyrics: () -> Unit,
    onToggleKaraoke: (Boolean) -> Unit,
    onTranslate: () -> Unit,
) {
    val lyrics by remember { mutableStateOf<LyricsRepo.Lyrics?>(null) }
    val lyricsLoading by remember { mutableStateOf(false) }
    val syncedLines = remember(lyrics) {
        (lyrics?.synced ?: "").let { if (it.isNotBlank()) LyricsRepo.parseLrc(it) else emptyList() }
    }
    val activeIdx = remember(syncedLines, PlayerManager.positionMs.value) {
        syncedLines.indexOfLast { it.first <= PlayerManager.positionMs.value }.coerceAtLeast(0)
    }
    val activeLine = syncedLines.getOrNull(activeIdx)?.second.orEmpty()

    // KARAOKE MODE
    if (karaoke) {
        KaraokeView(
            lines = syncedLines,
            activeIdx = activeIdx,
            onSeek = { onSeek(it) },
            onClose = { karaoke = false },
        )
        return
    }

    // TRANSLATING MODE
    if (translating) {
        // Show translation progress with "Translating…" and cancel option
        Column(
            modifier = Modifier.fillMaxSize().padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                IconButton(onClick = { translating = false }) {
                    Icon(Icons.Filled.Close, contentDescription = "Close translation")
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "Translating…",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.weight(1f))
        }
        return
    }

    // NORMAL LYRICS MODE
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(28.dp)
            .background(MaterialTheme.colorScheme.background),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Header row
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            IconButton(onClick = onCloseLyrics) {
                Icon(Icons.Filled.Close, contentDescription = "Close lyrics")
            }
        }
        Spacer(Modifier.height(24.dp))

        // Active line highlighted
        val line = syncedLines.getOrNull(activeIdx)?.second.orEmpty()
        Text(
            line,
            style = MaterialTheme.typography.displaySmall.copy(
                fontSize = 34.sp,
                fontWeight = FontWeight.Bold,
            ),
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(16.dp))

        // Next line preview
        Text(
            syncedLines.getOrNull(activeIdx + 1)?.second.orEmpty(),
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.weight(1f))
        Text(
            "Tap a line to seek",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // Lyrics list with kinetic scroll
        ScrollableLyricsList(
            lines = syncedLines,
            activeIdx = activeIdx,
            onSeek = onSeek,
        )

        // Translate button if we have source lyrics
        if (lyrics?.plain?.isNotBlank() == true || lyrics?.synced?.isNotBlank() == true) {
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Language selector pills
                LangPill("id", langTarget = langTarget, onSelect = { langTarget = it }, isTarget = true)
                LangPill("en", langTarget = langTarget, onSelect = { langTarget = it }, isTarget = false)

                // Translate/Karaoke action
                if (syncedLines.isNotEmpty()) {
                    Button(onClick = { karaoke = true }) {
                        Text("Karaoke", style = MaterialTheme.typography.labelMedium)
                    }
                } else if (translating) {
                    Button(onClick = { translating = false }) {
                        Text("Done", style = MaterialTheme.typography.labelMedium)
                    }
                } else {
                    Button(onClick = onTranslate) {
                        if (syncedLines.isNotEmpty()) {
                            Text("Karaoke", style = MaterialTheme.typography.labelMedium)
                        } else {
                            Text("Translate…", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }

            // Status lines
            if (lyricsLoading) {
                Text("Loading lyrics…", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else if (syncedLines.isNotEmpty()) {
                syncedLines.forEachIndexed { i, (time, text) ->
                    Text(
                        text,
                        color = if (i == activeIdx) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                        style = if (i == activeIdx)
                            MaterialTheme.typography.titleMedium
                            else MaterialTheme.typography.bodyMedium,
                        fontWeight = if (i == activeIdx) FontWeight.SemiBold else FontWeight.Normal,
                        modifier = Modifier.clickable { onSeek(time) },
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

// ---------- Helper: language pills ----------
@Composable
fun LangPill(
    code: String,
    langTarget: String,
    onSelect: (String) -> Unit,
    isTarget: Boolean,
) {
    val isSelected = langTarget == code
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(percent = 50))
            .background(
                if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
            )
            .clickable { onSelect(code) }
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        Text(
            code.uppercase(),
            color = if (isSelected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

// ---------- Helper: scrollable lyrics list with kinetic feel ----------
@Composable
fun ScrollableLyricsList(
    lines: List<Pair<Long, String>>,
    activeIdx: Int,
    onSeek: (Long) -> Unit,
) {
    val scrollState = rememberScrollState()
    Column(
        modifier = Modifier.verticalScroll(scrollState),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        lines.forEachIndexed { i, (time, text) ->
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .clickable { onSeek(time) }
                    .padding(vertical = 4.dp),
            ) {
                Text(
                    text,
                    color = if (i == activeIdx) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                    style = if (i == activeIdx)
                        MaterialTheme.typography.titleMedium
                        else MaterialTheme.typography.bodyMedium,
                    fontWeight = if (i == activeIdx) FontWeight.SemiBold else FontWeight.Normal,
                )
            }
        }
    }
}

// ---------- Karaoke view (extracted) ----------
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
                "Tap a line to seek",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}