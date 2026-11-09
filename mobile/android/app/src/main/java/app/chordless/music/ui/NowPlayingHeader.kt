package app.chordless.music.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Size
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Track
import app.chordless.music.ui.ArtworkPalette.Colors
import coil.compose.AsyncImage

/** Liquid glass accent — slightly blurred frosted glass look. */
private fun LiquidGlass(
    color: Color,
    topAlpha: Float = 0.3f,
    bottomAlpha: Float = 0.1f,
) = Brush.verticalGradient(
    listOf(
        color.copy(alpha = topAlpha),
        Color.Transparent.copy(alpha = bottomAlpha),
        Color.Transparent,
    ),
    center = Offset(0.5f, 0.0f),
)

@Composable
fun NowPlayingHeader(
    track: Track?,
    palette: Colors? = null,
    modifier: Modifier = Modifier,
) {
    if (track == null) {
        Column(modifier = modifier.align(Alignment.Center)) {
            Spacer(Modifier.height(40.dp))
            Text("Nothing playing", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        return
    }

    // --- Dynamic palette from artwork ---
    val paletteColor = palette?.dominant ?: when {
        track.thumbnail?.isNotBlank() -> {
            // Simple dominant color extraction fallback
            val scheme = MaterialTheme.colorScheme
            scheme.primary
        }
        else -> MaterialTheme.colorScheme.primary
    }
    val accent = if (paletteColor.red + paletteColor.green + paletteColor.blue) / 3f > 0.5f {
        // Light palette → dark on light
        MaterialTheme.colorScheme.copy(
            primary = MaterialTheme.colorScheme.primary.copy(alpha = 1f),
            onPrimary = Color.Black,
            surface = Color(0xFFF4F4F7),
            onSurface = Color(0xFF1C1C1E),
        ).primary
    } else {
        MaterialTheme.colorScheme.primary
    }

    // --- Liquid glass backdrop ---
    val glassTop = paletteColor.copy(alpha = 0.35f)
    val glassBottom = Color(0xFFFFFFFF).copy(alpha = 0.08f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(240.dp)
            .background(
                // Layered gradient: liquid glass + dynamic palette
                Brush.radialGradient(
                    offset = Offset(0.5f, -0.5f),
                    0.3f to paletteColor.copy(alpha = 0.20f),
                    1f to Color.Transparent,
                    center = Offset(0.5f, 0.0f),
                )
                    .copy(
                        topStop = paletteColor.copy(alpha = 0.12f),
                        bottomStop = Color.Transparent,
                    )
            )
    ) {
        // Frosted glass effect box behind cover
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    // Simulated blur via layered gradient + subtle noise
                    Brush.radialGradient(
                        0.5f to paletteColor.copy(alpha = 0.10f),
                        1.2f to Color(0x00FFFFFF).copy(alpha = 0.03f),
                        center = Offset(0.5f, 0.5f),
                    )
                )
        )

        // Cover area with dynamic gradient
        Box(
            modifier = Modifier
                .size(360.dp)
                .alignment(Alignment.Center)
                .background(
                    // Dynamic radial gradient from artwork
                    Brush.radialGradient(
                        0.5f to paletteColor.copy(alpha = 0.45f),
                        1f to Color.Transparent,
                    )
                )
        ) {
            // Cover art async image
            AsyncImage(
                model = track.thumbnail,
                contentDescription = null,
                modifier = Modifier.size(360.dp).clip(RoundedCornerShape(34.dp)),
                contentScale = androidx.compose.ui.content.ContentScale.Crop,
                alpha = 0.28f,
            )

            // Subtle highlight overlay
            Box(
                modifier = Modifier
                    .size(360.dp)
                    .clip(RoundedCornerShape(34.dp))
                    .background(
                        Brush.radialGradient(
                            0.5f to paletteColor.copy(alpha = 0.12f),
                            1f to Color.Transparent,
                        )
                    )
            )
        }

        Spacer(Modifier.height(24.dp))

        // Title with dynamic styling
        Text(
            track.title,
            style = MaterialTheme.typography.headlineSmall.copy(
                fontSize = 28.sp,
                fontWeight = androidx.compose.ui.text.font.FontWeight.W800,
                letterSpacing = (-0.5f).sp,
                color = when {
                    (paletteColor.red + paletteColor.green + paletteColor.blue) / 3f > 0.5f {
                        MaterialTheme.colorScheme.onSurface
                    }
                    else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                },
            ),
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            alignment = Alignment.CenterHorizontally,
        )

        Spacer(Modifier.height(4.dp))

        // Artist · Album with muted color
        Text(
            listOf(track.artist, track.album).filter { !it.isNullOrBlank() }.joinToString(" • "),
            style = MaterialTheme.typography.bodyMedium.copy(
                letterSpacing = 0.5f,
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
            alignment = Alignment.CenterHorizontally,
        )

        Spacer(Modifier.height(20.dp))

        // Progress area - subtle bar at bottom
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(
                    LiquidGlass(paletteColor, topAlpha = 0.25f, bottomAlpha = 0.08f)
                )
        ) {
            Row(
                modifier = Modifier.fillMaxSize().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Position label
                Text(
                    fmtMs(PlayerManager.positionMs.value),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                )
                // Duration label
                Text(
                    fmtMs(PlayerManager.durationMs.value),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                )
                // Seek bar placeholder (compact)
                androidx.compose.material3.Slider(
                    value = 0f,
                    onValueChange = {},
                    valueRange = 0f..1f,
                    colors = androidx.compose.material3.SliderDefaults.colors(
                        activeTrackColor = paletteColor,
                        thumbColor = paletteColor,
                        inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                    modifier = Modifier.width(200.dp),
                )
            }
        }
    }
}

private fun fmtMs(ms: Long): String {
    val s = (ms / 1000).toInt().coerceAtLeast(0)
    return "%d:%02d".format(s / 60, s % 60)
}