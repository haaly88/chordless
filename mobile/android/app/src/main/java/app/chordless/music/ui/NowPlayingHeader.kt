package app.chordless.music.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Track
import coil.compose.AsyncImage

@Composable
fun NowPlayingHeader(
    track: Track?,
    palette: app.chordless.music.ui.ArtworkPalette.Colors? = null,
    modifier: Modifier = Modifier,
) {
    if (track == null) {
        Column(modifier = modifier.align(Alignment.Center)) {
            Spacer(Modifier.height(40.dp))
            Text("Nothing playing", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    val dominant = palette?.dominant ?: MaterialTheme.colorScheme.primary
    val accent = MaterialTheme.colorScheme.primary

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp)
            .height(200.dp)
            .background(
                Brush.verticalGradient(
                    listOf(
                        dominant.copy(alpha = 0.45f),
                        Color.Transparent,
                        MaterialTheme.colorScheme.background,
                    )
                )
            )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            dominant.copy(alpha = 0.18f),
                            MaterialTheme.colorScheme.background.copy(alpha = 0.88f),
                        )
                    )
                )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .alignment(Alignment.CenterHorizontally)
                .padding(vertical = 16.dp),
        ) {
            Spacer(Modifier.height(20.dp))

            // Cover with dynamic gradient
            Box(
                modifier = Modifier
                    .size(360.dp)
                    .clip(RoundedCornerShape(34.dp))
                    .background(
                        Brush.radialGradient(
                            0.5f to dominant.copy(alpha = 0.45f),
                            1f to Color.Transparent,
                        )
                    )
            ) {
                AsyncImage(
                    model = track.thumbnail,
                    contentDescription = null,
                    modifier = Modifier.size(360.dp).clip(RoundedCornerShape(34.dp)),
                    contentScale = androidx.compose.ui.content.ContentScale.Crop,
                    alpha = 0.30f,
                )
            }

            Spacer(Modifier.height(32.dp))

            // Title
            MarqueeText(
                text = track.title,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = 26.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                ),
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(4.dp))

            // Artist · Album
            Text(
                listOf(track.artist, track.album).filter { !it.isNullOrBlank() }.joinToString(" • "),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            )

            Spacer(Modifier.height(16.dp))

            // Progress row
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    fmtMs(PlayerManager.positionMs.value),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    fmtMs(PlayerManager.durationMs.value),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}