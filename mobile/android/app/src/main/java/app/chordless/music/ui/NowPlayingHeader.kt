package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.chordless.music.data.Track
import coil.compose.AsyncImage

/**
 * Hero block of the Now Playing screen.
 *
 * Artwork sits on a palette-derived glow that reacts to the current track,
 * with oversized typography underneath — the LastWave signature look.
 */
@Composable
fun NowPlayingHeader(
    track: Track?,
    palette: ArtworkPalette.Colors? = null,
    modifier: Modifier = Modifier,
) {
    if (track == null) {
        Column(
            modifier = modifier.fillMaxWidth().padding(top = 64.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                "Nothing playing",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }

    val glow = palette?.dominant ?: MaterialTheme.colorScheme.primary
    val deep = palette?.dark ?: MaterialTheme.colorScheme.primary

    // Cover art scales with the screen so the controls always fit.
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val cover = minOf(maxWidth * 0.78f, 268.dp)
        val glowSize = cover * 1.22f

        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(contentAlignment = Alignment.Center) {
                // Soft palette glow behind the artwork.
                Box(
                    modifier = Modifier
                        .size(glowSize)
                        .blur(60.dp)
                        .clip(RoundedCornerShape(100.dp))
                        .background(
                            Brush.radialGradient(
                                listOf(glow.copy(alpha = 0.75f), Color.Transparent),
                            )
                        ),
                )
                // Deep halo ring for depth.
                Box(
                    modifier = Modifier
                        .size(cover * 1.08f)
                        .clip(RoundedCornerShape(48.dp))
                        .background(
                            Brush.radialGradient(
                                listOf(deep.copy(alpha = 0.35f), Color.Transparent),
                            )
                        ),
                )
                AsyncImage(
                    model = track.thumbnail,
                    contentDescription = null,
                    modifier = Modifier
                        .size(cover)
                        .shadow(26.dp, RoundedCornerShape(30.dp), clip = false)
                        .clip(RoundedCornerShape(30.dp))
                        .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(30.dp)),
                    contentScale = ContentScale.Crop,
                )
            }

            Spacer(Modifier.height(22.dp))

            MarqueeText(
                text = track.title,
                style = MaterialTheme.typography.headlineSmall.copy(
                    fontSize = 26.sp,
                    fontWeight = FontWeight.W800,
                    letterSpacing = (-0.5f).sp,
                    lineHeight = 31.sp,
                    shadow = Shadow(Color.Black.copy(alpha = 0.55f), Offset(0f, 2f), 6f),
                ),
                color = Color.White,
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(4.dp))

            Text(
                text = listOf(track.artist, track.album)
                    .filter { !it.isNullOrBlank() }
                    .joinToString("  •  "),
                style = MaterialTheme.typography.titleSmall.copy(
                    shadow = Shadow(Color.Black.copy(alpha = 0.5f), Offset(0f, 1f), 4f),
                ),
                color = Color.White.copy(alpha = 0.78f),
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
