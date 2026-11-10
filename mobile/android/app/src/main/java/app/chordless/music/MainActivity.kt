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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import app.chordless.music.data.Prefs
import app.chordless.music.player.PlayerManager
import app.chordless.music.ui.ChordlessApp
import app.chordless.music.ui.OnboardingScreen
import app.chordless.music.ui.theme.ChordlessTheme
import kotlinx.coroutines.launch

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
            val scope = rememberCoroutineScope()
            val accent by remember(ctx) { Prefs.accentFlow(ctx) }.collectAsState(initial = "red")
            val uiScale by remember(ctx) { Prefs.uiScaleFlow(ctx) }.collectAsState(initial = 1.0f)
            var onboarded by remember { mutableStateOf<Boolean?>(null) }

            LaunchedEffect(Unit) {
                onboarded = Prefs.onboarded(ctx)
            }

            ChordlessTheme(theme = "dark", accentId = accent) {
                // UI scale must scale the *device* density, never replace it.
                // Providing Density(0.9f) means 0.9 px per dp, which shrinks
                // the whole app to a third of its designed size on phones
                // (density ≈ 2.75): 16sp text renders at ~5sp.
                val base = LocalDensity.current
                CompositionLocalProvider(
                    LocalDensity provides Density(
                        density = base.density * uiScale,
                        fontScale = base.fontScale,
                    )
                ) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        when (onboarded) {
                            null -> Unit
                            false -> OnboardingScreen {
                                scope.launch {
                                    Prefs.setOnboarded(ctx, true)
                                    onboarded = true
                                }
                            }

                            true -> ChordlessApp()
                        }
                    }
                }
            }
        }
    }
}
