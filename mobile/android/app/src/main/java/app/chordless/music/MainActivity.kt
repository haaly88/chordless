package app.chordless.music

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import app.chordless.music.data.Prefs
import app.chordless.music.player.PlayerManager
import app.chordless.music.ui.ChordlessApp
import app.chordless.music.ui.theme.ChordlessTheme

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
            var theme by remember { mutableStateOf("system") }
            var accent by remember { mutableStateOf("red") }
            var uiScale by remember { mutableStateOf(0.9f) }
            LaunchedEffect(Unit) {
                theme = Prefs.theme(ctx)
                accent = Prefs.accent(ctx)
                uiScale = Prefs.uiScale(ctx)
            }
            ChordlessTheme(theme = theme, accentId = accent) {
                // Default UI scale 90% (user-overridable in Settings).
                CompositionLocalProvider(LocalDensity provides Density(uiScale)) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        ChordlessApp()
                    }
                }
            }
        }
    }
}
