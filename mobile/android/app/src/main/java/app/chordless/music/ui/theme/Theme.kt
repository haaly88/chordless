package app.chordless.music.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** Chordless — deep-space dark palette (matches the desktop app). */
val Accent = Color(0xFF8FA6FF)
val AccentSoft = Color(0xFFB3C0FF)
val BgDark = Color(0xFF07070C)
val SurfaceDark = Color(0xFF101018)
val Surface2Dark = Color(0xFF181824)
val TextMutedDark = Color(0xFF9A9AB0)

val BgLight = Color(0xFFF6F6FA)
val SurfaceLight = Color(0xFFFFFFFF)
val Surface2Light = Color(0xFFECECF4)
val TextMutedLight = Color(0xFF5A5A72)

private val DarkScheme = darkColorScheme(
    primary = Accent,
    onPrimary = Color.Black,
    secondary = AccentSoft,
    background = BgDark,
    onBackground = Color(0xFFE8E8F0),
    surface = SurfaceDark,
    onSurface = Color(0xFFE8E8F0),
    surfaceVariant = Surface2Dark,
    onSurfaceVariant = TextMutedDark,
    surfaceContainerHighest = Surface2Dark,
)

private val LightScheme = lightColorScheme(
    primary = Color(0xFF4E63D8),
    onPrimary = Color.White,
    background = BgLight,
    onBackground = Color(0xFF14141C),
    surface = SurfaceLight,
    onSurface = Color(0xFF14141C),
    surfaceVariant = Surface2Light,
    onSurfaceVariant = TextMutedLight,
    surfaceContainerHighest = Surface2Light,
)

@Composable
fun ChordlessTheme(
    theme: String = "system",
    content: @Composable () -> Unit,
) {
    val dark = when (theme) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    MaterialTheme(
        colorScheme = if (dark) DarkScheme else LightScheme,
        content = content,
    )
}
