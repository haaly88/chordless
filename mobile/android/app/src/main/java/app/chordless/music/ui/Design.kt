package app.chordless.music.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage

/**
 * Chordless design language.
 *
 * Deep, cinematic surfaces with oversized artwork and generous spacing —
 * the visual language we share with LastWave / BitChord.
 */
object Chordless {
    val radiusXL: Dp = 34.dp
    val radiusL: Dp = 26.dp
    val radiusM: Dp = 20.dp
    val radiusS: Dp = 14.dp
    val gutter: Dp = 22.dp
}

/** Frosted panel with a hairline border — the base surface of the app. */
@Composable
fun GlassPanel(
    modifier: Modifier = Modifier,
    radius: Dp = Chordless.radiusL,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(radius))
            .background(
                Brush.verticalGradient(
                    listOf(
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.92f),
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.62f),
                    )
                )
            )
            .border(
                BorderStroke(1.dp, Color.White.copy(alpha = 0.08f)),
                RoundedCornerShape(radius),
            ),
        content = content,
    )
}

/** Accent gradient panel used for hero cards and calls to action. */
@Composable
fun AccentPanel(
    modifier: Modifier = Modifier,
    radius: Dp = Chordless.radiusXL,
    content: @Composable BoxScope.() -> Unit,
) {
    val primary = MaterialTheme.colorScheme.primary
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(radius))
            .background(
                Brush.linearGradient(
                    listOf(
                        primary.copy(alpha = 0.95f),
                        primary.copy(alpha = 0.55f),
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
                    )
                )
            )
            .border(
                BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
                RoundedCornerShape(radius),
            ),
        content = content,
    )
}

/** Pill shaped filter chip. */
@Composable
fun PillChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.8f)
    val fg = if (selected) MaterialTheme.colorScheme.onPrimary
    else MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = fg,
            maxLines = 1,
        )
    }
}

/**
 * Large cover tile with a scrim and overlaid text — used in the quick-pick
 * grid and the library.
 */
@Composable
fun BigCoverTile(
    title: String,
    subtitle: String,
    image: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    corner: Dp = Chordless.radiusL,
    drawable: Int? = null,
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(corner))
            .clickable(onClick = onClick),
    ) {
        when {
            drawable != null -> Image(
                painter = painterResource(drawable),
                contentDescription = null,
                modifier = Modifier.matchParentSize(),
                contentScale = ContentScale.Crop,
            )

            image.isBlank() -> Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "♪",
                    style = MaterialTheme.typography.displaySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            else -> AsyncImage(
                model = image,
                contentDescription = null,
                modifier = Modifier.matchParentSize(),
                contentScale = ContentScale.Crop,
            )
        }
        // Bottom scrim so the label stays readable on any artwork.
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.verticalGradient(
                        0.45f to Color.Transparent,
                        1f to Color.Black.copy(alpha = 0.82f),
                    )
                )
        )
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(14.dp),
        ) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.72f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Section heading with an optional trailing action. */
@Composable
fun SectionHeading(
    title: String,
    modifier: Modifier = Modifier,
    action: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.W800,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (action != null && onAction != null) {
            Text(
                action,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable(onClick = onAction),
            )
        }
    }
}

/** Small statistic tile (plays, minutes, downloads…). */
@Composable
fun StatTile(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    GlassPanel(modifier = modifier, radius = Chordless.radiusM) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            Text(
                value,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.W800,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                label,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Circular artwork for lists and queues. */
@Composable
fun RoundArtwork(
    url: String,
    size: Dp = 48.dp,
    modifier: Modifier = Modifier,
) {
    if (url.isBlank()) {
        Box(
            modifier = modifier
                .size(size)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            Text("♪", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        AsyncImage(
            model = url,
            contentDescription = null,
            modifier = modifier.size(size).clip(CircleShape),
            contentScale = ContentScale.Crop,
        )
    }
}

/** Horizontal spacer helper. */
@Composable
fun HSpace(width: Dp) = Spacer(Modifier.width(width))
