package app.chordless.music.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Prefs
import app.chordless.music.player.PlayerManager
import kotlinx.coroutines.launch

/** 5-band EQ with presets — mirrors desktop Settings → EQ. */
@Composable
fun EqScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var gains by remember { mutableStateOf(listOf(0f, 0f, 0f, 0f, 0f)) }
    var enabled by remember { mutableStateOf(true) }
    var preset by remember { mutableStateOf("Custom") }

    val presets = mapOf(
        "Flat" to listOf(0f, 0f, 0f, 0f, 0f),
        "Bass" to listOf(6f, 3f, 0f, -1f, -2f),
        "Vocal" to listOf(-3f, 4f, 6f, 2f, 0f),
        "Classical" to listOf(2f, 0f, 1f, 3f, 4f),
        "Treble" to listOf(-1f, 0f, 1f, 4f, 6f),
    )
    val bandNames = listOf("Sub", "Low", "Mid", "High", "Air")

    LaunchedEffect(Unit) {
        gains = Prefs.eq(ctx).split(",").mapNotNull { it.toFloatOrNull() }.let {
            if (it.size == 5) it else List(5) { 0f }
        }
        enabled = Prefs.eqOn(ctx)
    }

    suspend fun save() {
        Prefs.setEq(ctx, gains.joinToString(","))
        Prefs.setEqOn(ctx, enabled)
        PlayerManager.refreshFx()
    }

    AuroraBackground {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()),
        ) {
            Text("Equalizer", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Enabled", style = MaterialTheme.typography.titleSmall)
                Switch(checked = enabled, onCheckedChange = {
                    enabled = it
                    scope.launch { save() }
                })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                presets.forEach { (name, g) ->
                    FilterChip(
                        selected = preset == name,
                        onClick = {
                            preset = name
                            gains = g
                            scope.launch { save() }
                        },
                        label = { Text(name) },
                    )
                }
            }
            bands(gains, bandNames) { i, v ->
                gains = gains.toMutableList().apply { this[i] = v }
                preset = "Custom"
                scope.launch { save() }
            }
        }
    }
}

@Composable
private fun bands(
    gains: List<Float>,
    names: List<String>,
    onChange: (Int, Float) -> Unit,
) {
    gains.forEachIndexed { i, g ->
        Column(modifier = Modifier.padding(vertical = 10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(names[i], style = MaterialTheme.typography.titleSmall)
                Text(
                    if (g == 0f) "0 dB" else "%+.0f dB".format(g),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Slider(
                value = g,
                onValueChange = { onChange(i, it) },
                valueRange = -12f..12f,
                colors = SliderDefaults.colors(
                    activeTrackColor = MaterialTheme.colorScheme.primary,
                    thumbColor = MaterialTheme.colorScheme.primary,
                ),
            )
        }
    }
}
