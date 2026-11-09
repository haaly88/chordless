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
    Font(R.font.inter, FontWeight.Normal),
    Font(R.font.inter, FontWeight.Medium),
    Font(R.font.inter, FontWeight.SemiBold),
    Font(R.font.inter, FontWeight.Bold),
    Font(R.font.inter, FontWeight.ExtraBold),
)

/** Desktop accent (#fc3c44, Apple-Music red). */
val Accent = Color(0xFFFC3C44)
val AccentSoft = Color(0xFFFF8A90)
val AccentOn = Color(0xFF1A0505)

private val BgDark = Color(0xFF000000)
private val Bg2Dark = Color(0xFF0D0D0F)
private val PanelDark = Color(0xFF1C1C1E)
private val TextDark = Color(0xFFFFFFFF)
private val Text2Dark = Color(0xFF8E8E93)
private val Text3Dark = Color(0xFF6E6E73)

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
    outline = Color(0xFF2C2C2E),
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
    // Always dark (BitChord/desktop parity) — no light mode in this app.
    val dark = true
    val accent = accentFor(accentId, dark)
    SystemBarIcons(dark = dark)
    val base = androidx.compose.material3.Typography()
    MaterialTheme(
        colorScheme = if (dark) darkScheme(accent) else lightScheme(accent),
        typography = androidx.compose.material3.Typography(
            displayLarge = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W800, fontSize = androidx.compose.ui.unit.sp(36), letterSpacing = androidx.compose.ui.unit.sp(-0.5)),
            displayMedium = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W800, fontSize = androidx.compose.ui.unit.sp(30), letterSpacing = androidx.compose.ui.unit.sp(-0.4)),
            displaySmall = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W800, fontSize = androidx.compose.ui.unit.sp(28), letterSpacing = androidx.compose.ui.unit.sp(-0.3)),
            headlineLarge = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W800, fontSize = androidx.compose.ui.unit.sp(28), letterSpacing = androidx.compose.ui.unit.sp(-0.4)),
            headlineMedium = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W700, fontSize = androidx.compose.ui.unit.sp(24), letterSpacing = androidx.compose.ui.unit.sp(-0.3)),
            headlineSmall = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W700, fontSize = androidx.compose.ui.unit.sp(22), letterSpacing = androidx.compose.ui.unit.sp(-0.2)),
            titleLarge = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W700, fontSize = androidx.compose.ui.unit.sp(20), letterSpacing = androidx.compose.ui.unit.sp(-0.2)),
            titleMedium = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W600, fontSize = androidx.compose.ui.unit.sp(17), letterSpacing = androidx.compose.ui.unit.sp(0.1)),
            titleSmall = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W600, fontSize = androidx.compose.ui.unit.sp(15), letterSpacing = androidx.compose.ui.unit.sp(0.1)),
            bodyLarge = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W400, fontSize = androidx.compose.ui.unit.sp(16), letterSpacing = androidx.compose.ui.unit.sp(0.15)),
            bodyMedium = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W400, fontSize = androidx.compose.ui.unit.sp(14.5), letterSpacing = androidx.compose.ui.unit.sp(0.2)),
            bodySmall = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W400, fontSize = androidx.compose.ui.unit.sp(13), letterSpacing = androidx.compose.ui.unit.sp(0.2)),
            labelLarge = base.labelLarge.copy(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W600),
            labelMedium = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W600, fontSize = androidx.compose.ui.unit.sp(12), letterSpacing = androidx.compose.ui.unit.sp(0.25)),
            labelSmall = androidx.compose.ui.text.TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.W600, fontSize = androidx.compose.ui.unit.sp(11.5), letterSpacing = androidx.compose.ui.unit.sp(0.3)),
        ),
        content = content,
    )
}
