package app.chordless.music.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Prefs
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }
    var theme by remember { mutableStateOf("system") }
    var expanded by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        gl = Prefs.gl(ctx)
        hl = Prefs.hl(ctx)
        theme = Prefs.theme(ctx)
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()),
    ) {
        Text("Region", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = gl,
                onValueChange = {
                    gl = it.uppercase().take(2)
                    scope.launch { Prefs.setGl(ctx, gl) }
                },
                label = { Text("Country (GL)") },
                modifier = Modifier.weight(1f),
                singleLine = true,
            )
            Spacer(Modifier.height(0.dp))
            OutlinedTextField(
                value = hl,
                onValueChange = {
                    hl = it.lowercase().take(2)
                    scope.launch { Prefs.setHl(ctx, hl) }
                },
                label = { Text("Language (HL)") },
                modifier = Modifier.weight(1f),
                singleLine = true,
            )
        }
        Spacer(Modifier.height(24.dp))
        Text("Appearance", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))
        ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
            OutlinedTextField(
                value = theme,
                onValueChange = {},
                readOnly = true,
                label = { Text("Theme") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth(),
            )
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                listOf("system", "dark", "light").forEach { option ->
                    DropdownMenuItem(
                        text = { Text(option) },
                        onClick = {
                            theme = option
                            scope.launch { Prefs.setTheme(ctx, option) }
                            expanded = false
                        },
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
        Text("Chordless 1.0 — fully native Android.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
