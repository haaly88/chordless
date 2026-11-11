package app.chordless.music.ui

import android.content.pm.PackageManager
import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.chordless.music.data.Prefs
import app.chordless.music.data.Track
import app.chordless.music.player.PlayerManager
import app.chordless.music.ui.theme.Accents
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onOpenEq: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var gl by remember { mutableStateOf("ID") }
    var hl by remember { mutableStateOf("en") }
    var theme by remember { mutableStateOf("system") }
    var lang by remember { mutableStateOf("en") }
    var accent by remember { mutableStateOf("red") }
    var uiScale by remember { mutableStateOf(1.0f) }
    var autoplay by remember { mutableStateOf(true) }
    var normalize by remember { mutableStateOf(false) }
    var sponsor by remember { mutableStateOf(true) }
    var notify by remember { mutableStateOf(false) }
    var themeOpen by remember { mutableStateOf(false) }
    var langOpen by remember { mutableStateOf(false) }
    var scaleOpen by remember { mutableStateOf(false) }
    var sleepOpen by remember { mutableStateOf(false) }
    var crossfadeOpen by remember { mutableStateOf(false) }
    var crossfade by remember { mutableStateOf(0.5f) }

    LaunchedEffect(Unit) {
        gl = Prefs.gl(ctx); hl = Prefs.hl(ctx); theme = Prefs.theme(ctx)
        lang = Prefs.lang(ctx); accent = Prefs.accent(ctx); uiScale = Prefs.uiScale(ctx)
        autoplay = Prefs.autoplay(ctx); normalize = Prefs.normalize(ctx)
        sponsor = Prefs.sponsorSkip(ctx); notify = Prefs.notify(ctx)
        crossfade = Prefs.crossfade(ctx)
    }

    val notifPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        notify = granted
        scope.launch { Prefs.setNotify(ctx, granted) }
    }

    AuroraBackground {
        Column(
            modifier = Modifier.fillMaxSize().padding(20.dp).verticalScroll(rememberScrollState()),
        ) {
            Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(16.dp))

            SectionLabel("General")
            SettingRow("Language") {
                ExposedDropdownMenuBox(expanded = langOpen, onExpandedChange = { langOpen = !langOpen }) {
                    OutlinedTextField(
                        value = if (lang == "id") "Bahasa Indonesia" else "English",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(langOpen) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                    )
                    ExposedDropdownMenu(expanded = langOpen, onDismissRequest = { langOpen = false }) {
                        listOf("en" to "English", "id" to "Bahasa Indonesia").forEach { (code, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    lang = code
                                    scope.launch { Prefs.setLang(ctx, code) }
                                    langOpen = false
                                }
                            )
                        }
                    }
                }
            }
            SettingRow("Region") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = gl,
                        onValueChange = {
                            val next = it.uppercase().take(2)
                            gl = next
                            scope.launch { Prefs.setGl(ctx, next) }
                        },
                        label = { Text("GL") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                    )
                    OutlinedTextField(
                        value = hl,
                        onValueChange = {
                            val next = it.lowercase().take(2)
                            hl = next
                            scope.launch { Prefs.setHl(ctx, next) }
                        },
                        label = { Text("HL") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                    )
                }
            }

            SectionLabel("Appearance")
            SettingRow(
                title = "Theme",
                subtitle = "Dark — always on (matches the desktop app)",
            ) {
                // Theme is fixed to dark; nothing to choose.
            }
            SettingRow("Accent") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Accents.forEach { (id, color) ->
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(color)
                                .clickable {
                                    accent = id
                                    scope.launch { Prefs.setAccent(ctx, id) }
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            if (accent == id) Text("✓", color = androidx.compose.ui.graphics.Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            SettingRow("UI scale") {
                ExposedDropdownMenuBox(expanded = scaleOpen, onExpandedChange = { scaleOpen = !scaleOpen }) {
                    OutlinedTextField(
                        value = "${(uiScale * 100).toInt()}%",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(scaleOpen) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                    )
                    ExposedDropdownMenu(expanded = scaleOpen, onDismissRequest = { scaleOpen = false }) {
                        listOf(0.8f, 0.9f, 1f, 1.1f).forEach { option ->
                            DropdownMenuItem(
                                text = { Text("${(option * 100).toInt()}%") },
                                onClick = {
                                    uiScale = option
                                    scope.launch { Prefs.setUiScale(ctx, option) }
                                    scaleOpen = false
                                }
                            )
                        }
                    }
                }
            }

            SectionLabel("Playback")
            SwitchRow("Autoplay / Radio", "Continue with similar tracks", autoplay) {
                autoplay = it
                scope.launch { Prefs.setAutoplay(ctx, it) }
            }
            SwitchRow("Normalize loudness", "Even out volume peaks", normalize) {
                normalize = it
                scope.launch {
                    Prefs.setNormalize(ctx, it)
                    PlayerManager.refreshFx()
                }
            }
            SwitchRow("Skip SponsorBlock", "Auto-skip sponsored segments", sponsor) {
                sponsor = it
                scope.launch { Prefs.setSponsorSkip(ctx, it) }
            }
            SettingRow("Crossfade") {
                ExposedDropdownMenuBox(expanded = crossfadeOpen, onExpandedChange = { crossfadeOpen = !crossfadeOpen }) {
                    OutlinedTextField(
                        value = "${(crossfade * 100).toInt()}%",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(crossfadeOpen) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                    )
                    ExposedDropdownMenu(expanded = crossfadeOpen, onDismissRequest = { crossfadeOpen = false }) {
                        listOf(0f, 0.5f, 1f, 2f).forEach { option ->
                            DropdownMenuItem(
                                text = { Text("${(option * 100).toInt()}%") },
                                onClick = {
                                    crossfade = option
                                    scope.launch { Prefs.setCrossfade(ctx, option) }
                                    crossfadeOpen = false
                                }
                            )
                        }
                    }
                }
            }
            SettingRow("Sleep timer") {
                ExposedDropdownMenuBox(expanded = sleepOpen, onExpandedChange = { sleepOpen = !sleepOpen }) {
                    OutlinedTextField(
                        value = PlayerManager.sleepChip() ?: "Off",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(sleepOpen) },
                        modifier = Modifier.menuAnchor().fillMaxWidth(),
                    )
                    ExposedDropdownMenu(expanded = sleepOpen, onDismissRequest = { sleepOpen = false }) {
                        listOf(-1 to "End of track", 5 to "5 minutes", 10 to "10 minutes", 15 to "15 minutes", 30 to "30 minutes", 60 to "60 minutes", 0 to "Off").forEach { (min, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    PlayerManager.setSleep(if (min == 0) null else min)
                                    sleepOpen = false
                                }
                            )
                        }
                    }
                }
            }

            SectionLabel("Audio")
            SettingActionRow(
                title = "Equalizer",
                subtitle = "5-band EQ + presets",
                action = {
                    androidx.compose.material3.TextButton(onClick = onOpenEq) { Text("Open") }
                }
            )

            SectionLabel("Notifications")
            SwitchRow("Song notifications", "Show a notification for each song", notify) {
                if (it && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    notify = it
                    scope.launch { Prefs.setNotify(ctx, it) }
                }
            }

            SectionLabel("About")
            Text(
                "Chordless 1.1 (native Android)\\n" +
                    "YouTube Music client with synced lyrics\\n" +
                    "(LRCLIB + LRC.red), stream resolution via NewPipe,\\n" +
                    "playback via Media3.\\n" +
                    "Fully standalone — no server required.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 20.dp, bottom = 8.dp),
    )
}

@Composable
private fun SettingRow(title: String, subtitle: String? = null, content: @Composable () -> Unit) {
    Column(modifier = Modifier.padding(vertical = 8.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        if (!subtitle.isNullOrBlank()) {
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun SettingActionRow(title: String, subtitle: String? = null, action: @Composable () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        action()
    }
}

@Composable
private fun SwitchRow(
    title: String,
    subtitle: String,
    value: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = value, onCheckedChange = onChange)
    }
}
