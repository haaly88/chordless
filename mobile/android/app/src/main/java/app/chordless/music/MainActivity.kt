package app.chordless.music

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import app.chordless.music.data.Prefs
import app.chordless.music.player.PlayerManager
import app.chordless.music.ui.ChordlessApp
import app.chordless.music.ui.theme.ChordlessTheme
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/** Syncs status/navigation icon tones with the in-app theme (BitChord parity). */
@Composable
fun SystemBarIcons(dark: Boolean) {
    val view = LocalView.current
    if (view.isInEditMode) return
    SideEffect {
        var current: android.view.View? = view
        var window: android.view.Window? = null
        while (current != null) {
            val ctx = current.context
            if (ctx is ComponentActivity) {
                window = ctx.window
                break
            }
            current = current.parent as? android.view.View
        }
        if (window != null) {
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = dark
                isAppearanceLightNavigationBars = dark
            }
        }
    }
}

/** Chordless — fully native Android (Compose + Media3). */
class ChordlessApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        PlayerManager.init(this)
    }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val ctx = LocalContext.current
            val theme by remember(ctx) { Prefs.themeFlow(ctx) }.collectAsState(initial = "system")
            val accent by remember(ctx) { Prefs.accentFlow(ctx) }.collectAsState(initial = "red")
            val uiScale by remember(ctx) { Prefs.uiScaleFlow(ctx) }.collectAsState(initial = 1.0f)
            ChordlessTheme(theme = "dark", accentId = accent) {
                SystemBarIcons(dark = true)
                // Default UI scale 100% (user-overridable in Settings).
                CompositionLocalProvider(LocalDensity provides Density(uiScale)) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        ChordlessApp()
                    }
                }
            }
        }
    }
}
