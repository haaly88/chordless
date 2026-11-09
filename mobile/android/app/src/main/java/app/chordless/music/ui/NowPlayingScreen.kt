package app.chordless.music.ui

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import app.chordless.music.data.LyricsRepo
import app.chordless.music.data.Prefs
import app.chordless.music.player.PlayerManager
import coil.compose.AsyncImage

@Composable
fun NowPlayingScreen() {
    val track by PlayerManager.current.collectAsState()
    val position by PlayerManager.positionMs.collectAsState()
    val isPlaying by PlayerManager.isPlaying.collectAsState()
    val loading by PlayerManager.loading.collectAsState()
    val error by PlayerManager.error.collectAsState()
    val ctx = LocalContext.current

    var favIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var lyrics by remember { mutableStateOf<LyricsRepo.Lyrics?>(null) }
    var lyricsLoading by remember { mutableStateOf(false) }
    var showLyrics by remember { mutableStateOf(false) }

    val t = track
    if (t != null) {
        androidx.compose.runtime.LaunchedEffect(t.id) {
            favIds = Prefs.favorites(ctx)
            lyricsLoading = true
            lyrics = try {
                LyricsRepo.get(t.artist, t.title, t.album, t.duration.toInt())
            } catch (e: Exception) {
                LyricsRepo.Lyrics()
            }
            lyricsLoading = false
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(
            Brush.verticalGradient(
                listOf(
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
                    Color.Transparent,
                    MaterialTheme.colorScheme.background,
                )
            )
        )
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(20.dp))
            if (t == null) {
                Text("Nothing playing", color = MaterialTheme.colorScheme.onSurfaceVariant)
                return@Column
            }
            AsyncImage(
                model = t.thumbnail,
                contentDescription = null,
                modifier = Modifier.size(300.dp).shadow(32.dp, RoundedCornerShape(28.dp)).clip(RoundedCornerShape(28.dp)),
                contentScale = ContentScale.Crop,
            )
            Spacer(Modifier.height(28.dp))
            Text(
                t.title,
                fontSize = 26.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                t.artist,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (error != null) {
                Text(error!!, color = MaterialTheme.colorScheme.error, textAlign = TextAlign.Center)
            } else if (loading) {
                Text("Loading…", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Spacer(Modifier.height(20.dp))
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

            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { PlayerManager.prev() }) {
                    Icon(Icons.Filled.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(44.dp))
                }
                Button(
                    onClick = { PlayerManager.toggle() },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                    shape = CircleShape,
                    modifier = Modifier.size(76.dp).padding(4.dp),
                ) {
                    Icon(
                        if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = if (isPlaying) "Pause" else "Play",
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(36.dp),
                    )
                }
                IconButton(onClick = { PlayerManager.next() }) {
                    Icon(Icons.Filled.SkipNext, contentDescription = "Next", modifier = Modifier.size(44.dp))
                }
                IconButton(onClick = {
                    kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                        Prefs.setFavorite(ctx, t.id, t.id !in favIds)
                        favIds = Prefs.favorites(ctx)
                    }
                }) {
                    Icon(
                        if (t.id in favIds) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "Favorite",
                        tint = if (t.id in favIds) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(32.dp),
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            androidx.compose.material3.TextButton(onClick = { showLyrics = !showLyrics }) {
                Text(if (showLyrics) "Hide lyrics" else "Lyrics")
            }
            if (showLyrics) {
                if (lyricsLoading) Text("Loading lyrics…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                else {
                    val l = lyrics
                    when {
                        l?.synced?.isNotBlank() == true -> {
                            val lines = LyricsRepo.parseLrc(l.synced)
                            val activeIdx = lines.indexOfLast { it.first <= position }.coerceAtLeast(0)
                            lines.forEachIndexed { i, (time, text) ->
                                Text(
                                    text,
                                    color = if (i == activeIdx) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.85f),
                                    style = if (i == activeIdx) MaterialTheme.typography.titleMedium else MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (i == activeIdx) FontWeight.SemiBold else FontWeight.Normal,
                                )
                            }
                        }
                        l?.plain?.isNotBlank() == true -> Text(l.plain)
                        else -> Text("No lyrics found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
