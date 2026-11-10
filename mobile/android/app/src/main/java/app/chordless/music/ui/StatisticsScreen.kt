package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.LocalStore
import java.util.Calendar

/**
 * Listening statistics computed from the on-device history.
 */
@Composable
fun StatisticsScreen() {
    val ctx = LocalContext.current
    var history by remember { mutableStateOf<Map<String, LocalStore.HistoryEntry>>(emptyMap()) }
    var loaded by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        history = LocalStore.history(ctx)
        loaded = true
    }

    val plays = history.values.sumOf { it.count }
    val minutes = history.values.sumOf { it.count * (it.track.duration.coerceAtLeast(0)) } / 60
    val unique = history.size
    val topArtist = history.values
        .groupBy { it.track.artist.ifBlank { "Unknown" } }
        .mapValues { (_, v) -> v.sumOf { it.count } }
        .maxByOrNull { it.value }
    val topTracks = history.values.sortedByDescending { it.count }.take(8)

    // Plays per weekday, oldest first.
    val perDay = remember(history) {
        val days = IntArray(7)
        history.values.forEach { entry ->
            val cal = Calendar.getInstance().apply { timeInMillis = entry.lastPlayed }
            days[(cal.get(Calendar.DAY_OF_WEEK) - 1) % 7] += entry.count
        }
        days
    }
    val maxDay = perDay.maxOrNull()?.coerceAtLeast(1) ?: 1

    AuroraBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = Chordless.gutter,
                end = Chordless.gutter,
                bottom = 210.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Spacer(Modifier.height(16.dp))
                Text(
                    "Statistics",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.W900,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Your listening, on this device",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatTile(
                        value = "$plays",
                        label = "Plays",
                        modifier = Modifier.weight(1f),
                    )
                    StatTile(
                        value = if (minutes >= 60) "${minutes / 60}h ${minutes % 60}m" else "$minutes m",
                        label = "Listening",
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatTile(
                        value = "$unique",
                        label = "Unique tracks",
                        modifier = Modifier.weight(1f),
                    )
                    StatTile(
                        value = topArtist?.key?.take(12) ?: "—",
                        label = "Top artist",
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            item {
                Spacer(Modifier.height(6.dp))
                SectionHeading("Plays per weekday")
            }

            item {
                GlassPanel(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        val labels = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                        perDay.forEachIndexed { index, count ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    labels[index],
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(width = 40.dp, height = 18.dp),
                                )
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(14.dp)
                                        .clip(RoundedCornerShape(percent = 50))
                                        .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.5f)),
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth((count.toFloat() / maxDay).coerceIn(0.02f, 1f))
                                            .height(14.dp)
                                            .clip(RoundedCornerShape(percent = 50))
                                            .background(MaterialTheme.colorScheme.primary),
                                    )
                                }
                                Text(
                                    "$count",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.size(width = 34.dp, height = 18.dp),
                                )
                            }
                        }
                    }
                }
            }

            if (topTracks.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(6.dp))
                    SectionHeading("Most played")
                }
                items(topTracks) { entry ->
                    GlassPanel(modifier = Modifier.fillMaxWidth(), radius = Chordless.radiusM) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            RoundArtwork(entry.track.thumbnail, 44.dp)
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(horizontal = 12.dp),
                            ) {
                                Text(
                                    entry.track.title,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.W700,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    maxLines = 1,
                                )
                                Text(
                                    entry.track.artist,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                )
                            }
                            Text(
                                "${entry.count}×",
                                style = MaterialTheme.typography.titleSmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
            }

            if (!loaded) {
                item { LoadingBox() }
            }
        }
    }
}
