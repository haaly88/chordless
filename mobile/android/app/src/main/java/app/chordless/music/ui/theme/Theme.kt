package app.chordless.music.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
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

/** Dark palette — deep, premium, matches desktop. */
private val BgDark = Color(0xFF000000)
private val Bg2Dark = Color(0xFF0A0A0C)
private val PanelDark = Color(0xFF141418)
private val TextDark = Color(0xFFFFFFFF)
private val Text2Dark = Color(0xFFA3A3AD)

private val BgLight = Color(0xFFF4F4F7)
private val Bg2Light = Color(0xFFECECF0)
private val PanelLight = Color(0xFFFFFFFF)
private val TextLight = Color(0xFF1C1C1E)
private val Text2Light = Color(0xFF5B5B63)

/** Accent swatches. */
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

/** Status/navigation bar icon colors for the (always dark) app shell. */
@Composable
fun SystemBarIcons(dark: Boolean) {
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = !dark
            controller.isAppearanceLightNavigationBars = !dark
        }
    }
}

/** Chordless theme — Expressive typography, dark by default. */
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
    MaterialTheme(
        colorScheme = darkScheme(accent),
        typography = Typography(
            // Expressive, bold display type — LastWave-style
            displayLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W900, fontSize = 40.sp, letterSpacing = (-0.75f).sp),
            displayMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W900, fontSize = 32.sp, letterSpacing = (-0.6f).sp),
            displaySmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W900, fontSize = 26.sp, letterSpacing = (-0.5f).sp),
            headlineLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W900, fontSize = 32.sp, letterSpacing = (-0.6f).sp),
            headlineMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W800, fontSize = 28.sp, letterSpacing = (-0.5f).sp),
            headlineSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W800, fontSize = 24.sp, letterSpacing = (-0.4f).sp),
            titleLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W800, fontSize = 22.sp, letterSpacing = (-0.3f).sp),
            titleMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W700, fontSize = 18.sp, letterSpacing = (-0.2f).sp),
            titleSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W700, fontSize = 16.sp, letterSpacing = 0.0f),
            bodyLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W500, fontSize = 17.sp, letterSpacing = 0.15f.sp),
            bodyMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W500, fontSize = 15.sp, letterSpacing = 0.2f.sp),
            bodySmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W500, fontSize = 13.sp, letterSpacing = 0.2f.sp),
            labelLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W600, fontSize = 14.sp, letterSpacing = 0.1f.sp),
            labelMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W600, fontSize = 12.sp, letterSpacing = 0.25f.sp),
            labelSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.W600, fontSize = 11.sp, letterSpacing = 0.3f.sp),
        ),
        content = content,
    )
}
