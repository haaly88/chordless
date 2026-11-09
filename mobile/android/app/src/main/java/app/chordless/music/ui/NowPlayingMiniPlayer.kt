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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import coil.compose.AsyncImage
import kotlinx.coroutines.ui.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.animateFloat

@Composable
fun NowPlayingMiniPlayer(
    track: Track?,
    isPlaying: Boolean,
    loading: Boolean,
    positionMs: Long,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val durationMs = PlayerManager.durationMs.value
    val sleepChip = PlayerManager.sleepChip()

    Box(
        modifier = modifier
            .padding(horizontal = 14.dp, vertical = 8.dp)
            .shadow(16.dp, RoundedCornerShape(26.dp))
            .clip(RoundedCornerShape(26.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.92f))
            .clickable(onClick = onOpen)
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Artwork(track?.thumbnail ?: "", size = 60.dp, radius = 18.dp)

            Column(modifier = Modifier.weight(1f)) {
                MarqueeText(
                    text = track?.title ?: "",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    (if (loading) "Loading… " else "") +
                        (sleepChip?.let { "Sleep $it · " } else "") + track?.artist ?: "",
                    maxLines = 1,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            IconButton(onClick = {
                // Haptic feedback + toggle
                LocalHapticFeedback.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.Keypress)
                PlayerManager.toggle()
            }) {
                Icon(
                    if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = if (isPlaying) "Pause" else "Play",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(36.dp),
                )
            }
        }

        // Progress bar if track has duration
        if (durationMs > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(horizontal = 12.dp, vertical = 2.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(percent = 50))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(positionMs.toFloat() / durationMs.coerceIn(0f, 1f))
                        .padding(vertical = 1.dp)
                        .clip(RoundedCornerShape(percent = 50))
                        .background(MaterialTheme.colorScheme.primary),
                ) {}
            }
        }
    }
}

// ---------- Artwork helper (reuse from Components.kt) ----------
@Composable
fun Artwork(url: String, size: Dp = 56.dp, radius: Dp = 12.dp) {
    if (url.isBlank()) {
        Box(
            modifier = Modifier.size(size).clip(RoundedCornerShape(radius)).background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Text("♪", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.titleLarge)
        }
    } else {
        AsyncImage(
            model = url,
            contentDescription = null,
            modifier = Modifier.size(size).clip(RoundedCornerShape(radius)),
            contentScale = androidx.compose.ui.content.ContentScale.Crop,
        )
    }
}