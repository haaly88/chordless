package app.chordless.music.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Track
import coil.compose.AsyncImage

// ---------- backdrop ----------
@Composable
fun AuroraBackground(content: @Composable () -> Unit) {
    Box(modifier = Modifier.fillMaxSize()) {
        val scheme = MaterialTheme.colorScheme
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.linearGradient(
                    listOf(
                        scheme.primary.copy(alpha = 0.16f),
                        scheme.background,
                        scheme.background,
                    ),
                )
            )
        )
        Box(
            modifier = Modifier.fillMaxSize().background(
                Brush.radialGradient(
                    0.5f to scheme.primary.copy(alpha = 0.10f),
                    1.2f to Color.Transparent,
                    center = androidx.compose.ui.geometry.Offset(0.5f, 0.0f),
                    radius = 1200f,
                )
            )
        )
        content()
    }
}

// ---------- header / sections ----------
@Composable
fun SectionHeader(
    title: String,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
        if (!subtitle.isNullOrBlank()) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

// ---------- cover & cards ----------
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
            contentScale = ContentScale.Crop,
        )
    }
}

@Composable
fun CoverCard(
    title: String,
    subtitle: String,
    image: String,
    onClick: () -> Unit,
    size: Dp = 160.dp,
) {
    Column(modifier = Modifier.width(size).clickable(onClick = onClick)) {
        Artwork(image, size = size, radius = 20.dp)
        Text(
            title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.paddingTop(),
        )
        Text(
            subtitle,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun Modifier.paddingTop() = this.then(padding(top = 10.dp))

// ---------- marquee title (desktop player-bar behaviour) ----------
@Composable
fun MarqueeText(
    text: String,
    style: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodyLarge,
    color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.onSurface,
    modifier: Modifier = Modifier,
) {
    var needsScroll by remember { mutableStateOf(false) }
    var viewportW by remember { mutableStateOf(0) }
    var textW by remember { mutableStateOf(0) }
    val density = LocalDensity.current
    Box(modifier = modifier.onSizeChanged { viewportW = it.width }) {
        if (!needsScroll) {
            Text(
                text,
                style = style,
                color = color,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                onTextLayout = {
                    textW = it.size.width
                    needsScroll = textW > viewportW && viewportW > 0
                },
            )
        } else {
            val transition = rememberInfiniteTransition(label = "marquee")
            val travel = with(density) { (textW + with(density) { 48.dp.toPx() }).toDp() }
            val offsetX by transition.animateFloat(
                initialValue = 0f,
                targetValue = -travel.value,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = (travel.value * 28).toInt().coerceAtLeast(4000), easing = LinearEasing),
                ),
                label = "marqueeX",
            )
            Row(modifier = Modifier.offset(x = offsetX.dp)) {
                Text(text, style = style, color = color, maxLines = 1, softWrap = false)
                Spacer(Modifier.width(48.dp))
                Text(text, style = style, color = color, maxLines = 1, softWrap = false)
            }
        }
    }
}

// ---------- track row ----------
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TrackRow(
    track: Track,
    onClick: () -> Unit,
    index: Int = -1,
    isFavorite: Boolean = false,
    onToggleFavorite: (() -> Unit)? = null,
    isCurrent: Boolean = false,
    onLongClick: (() -> Unit)? = null,
) {
    val chip = kindChip(track.kind)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .then(
                if (onLongClick != null) {
                    Modifier.combinedClickable(onClick = onClick, onLongClick = { onLongClick() })
                } else {
                    Modifier.clickable(onClick = onClick)
                }
            )
            .background(
                if (isCurrent) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
                else Color.Transparent
            )
            .paddingRow(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (index >= 0) {
            Text(
                "%02d".format(index + 1),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(28.dp),
            )
        }
        Artwork(track.thumbnail, size = 52.dp, radius = 12.dp)
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (chip != null) KindBadge(chip)
                Text(
                    track.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f, fill = false),
                )
            }
            Text(
                track.artist.ifBlank { track.kind },
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (track.duration > 0) {
            Text(
                fmtDur(track.duration),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (onToggleFavorite != null) {
            IconButton(onClick = onToggleFavorite) {
                Icon(
                    if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                    contentDescription = "Favorite",
                    tint = if (isFavorite) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun Modifier.paddingRow() = this.then(padding(horizontal = 8.dp, vertical = 6.dp))

@Composable
fun KindBadge(kind: String) {
    Box(
        modifier = Modifier
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .paddingRow2(),
    ) {
        Text(kind.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private fun Modifier.paddingRow2() = this.then(padding(horizontal = 7.dp, vertical = 2.dp))

private fun kindChip(kind: String): String? = when (kind) {
    "song" -> "Song"
    "video" -> "Video"
    "album" -> "Album"
    "artist" -> "Artist"
    else -> null
}

// ---------- states ----------
@Composable
fun ErrorBox(message: String, onRetry: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.size(48.dp))
        Text(message.ifBlank { "Something went wrong" }, color = MaterialTheme.colorScheme.error)
        TextButton(onClick = onRetry) { Text("Retry") }
    }
}

@Composable
fun LoadingBox() {
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Spacer(Modifier.size(48.dp))
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
    }
}

@Composable
fun EmptyState(title: String, subtitle: String? = null) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.size(56.dp))
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        if (!subtitle.isNullOrBlank()) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

fun fmtDur(sec: Long): String {
    val s = sec.coerceAtLeast(0)
    return "%d:%02d".format(s / 60, s % 60)
}

fun fmtMs(ms: Long): String {
    val s = (ms / 1000).toInt().coerceAtLeast(0)
    return "%d:%02d".format(s / 60, s % 60)
}
