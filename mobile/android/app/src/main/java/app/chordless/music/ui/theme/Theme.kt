package app.chordless.music.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import app.chordless.music.R

/** Inter — same typeface as the desktop app. */
val Inter = FontFamily(
    Font(R.font.inter, FontWeight.Normal, fontVariationSettings = "wght 400"),
    Font(R.font.inter, FontWeight.Medium, fontVariationSettings = "wght 500"),
    Font(R.font.inter, FontWeight.SemiBold, fontVariationSettings = "wght 600"),
    Font(R.font.inter, FontWeight.Bold, fontVariationSettings = "wght 700"),
    Font(R.font.inter, FontWeight.ExtraBold, fontVariationSettings = "wght 800"),
)

/** Desktop accent (#fc3c44, Apple-Music red). */
val Accent = Color(0xFFFC3C44)
val AccentSoft = Color(0xFFFF8A90)
val AccentOn = Color(0xFF1A0505)

private val BgDark = Color(0xFF0B0B0E)
private val Bg2Dark = Color(0xFF101017)
private val PanelDark = Color(0xFF17171E)
private val TextDark = Color(0xFFF5F5F7)
private val Text2Dark = Color(0xFFA6A6AE)
private val Text3Dark = Color(0xFF9A9AA2)

private val BgLight = Color(0xFFF4F4F7)
private val Bg2Light = Color(0xFFECECF0)
private val PanelLight = Color(0xFFFFFFFF)
private val TextLight = Color(0xFF1C1C1E)
private val Text2Light = Color(0xFF5B5B63)
private val Text3Light = Color(0xFF6B6B72)

/** Accent swatches (mirrors desktop Settings → Accent). */
val Accents: Map<String, Color> = mapOf(
    "red" to Color(0xFFFC3C44),
    "purple" to Color(0xFF8B5CF6),
    "blue" to Color(0xFF3B82F6),
    "green" to Color(0xFF22C55E),
    "orange" to Color(0xFFF59E0B),
    "pink" to Color(0xFFEC4899),
    "teal" to Color(0xFF14B8A6),
)

fun accentFor(id: String?, dark: Boolean): Color = Accents[id] ?: Accent

private fun darkScheme(accent: Color) = darkColorScheme(
    primary = accent,
    onPrimary = AccentOn,
    secondary = AccentSoft,
    background = BgDark,
    onBackground = TextDark,
    surface = Bg2Dark,
    onSurface = TextDark,
    surfaceVariant = PanelDark,
    onSurfaceVariant = Text2Dark,
    surfaceContainerHighest = PanelDark,
    outline = Color.White.copy(alpha = 0.09f),
)

private fun lightScheme(accent: Color) = lightColorScheme(
    primary = accent,
    onPrimary = Color.White,
    background = BgLight,
    onBackground = TextLight,
    surface = Bg2Light,
    onSurface = TextLight,
    surfaceVariant = PanelLight,
    onSurfaceVariant = Text2Light,
    surfaceContainerHighest = PanelLight,
    outline = Color.Black.copy(alpha = 0.08f),
)

@Composable
fun ChordlessTheme(
    theme: String = "system",
    accentId: String? = null,
    content: @Composable () -> Unit,
) {
    val dark = when (theme) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    val accent = accentFor(accentId, dark)
    MaterialTheme(
        colorScheme = if (dark) darkScheme(accent) else lightScheme(accent),
        typography = androidx.compose.material3.Typography(
            defaultFontFamily = Inter,
        ),
        content = content,
    )
}
