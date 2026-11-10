package app.chordless.music.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.chordless.music.player.PlayerManager
import app.chordless.music.together.Together

/**
 * Listen Together — host a room on the local network or join one.
 */
@Composable
fun TogetherScreen() {
    val state by Together.state.collectAsState()
    var address by remember { mutableStateOf("192.168.1.") }
    var port by remember { mutableStateOf("38000") }
    var code by remember { mutableStateOf("") }

    // Publish the local playback while hosting.
    val current by PlayerManager.current.collectAsState()
    androidx.compose.runtime.LaunchedEffect(current?.id, state.hosting) {
        if (state.hosting && current != null) {
            Together.publish(current!!.title, current!!.artist, PlayerManager.positionMs.value)
        }
    }

    AuroraBackground {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = Chordless.gutter,
                end = Chordless.gutter,
                bottom = 210.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item {
                Spacer(Modifier.height(16.dp))
                Text(
                    "Listen Together",
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.W900,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    "Sync playback with everyone on your network",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            item {
                GlassPanel(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(
                            Icons.Filled.Groups,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(38.dp),
                        )
                        Spacer(Modifier.height(10.dp))
                        if (state.hosting) {
                            Text(
                                "Room code",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                state.code,
                                style = MaterialTheme.typography.displaySmall,
                                fontWeight = FontWeight.W900,
                                color = MaterialTheme.colorScheme.primary,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                "Share ${state.address}:${state.port} with the code",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "${state.members} listening · ${state.title}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(Modifier.height(14.dp))
                            Button(
                                onClick = { Together.stopHosting() },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.error,
                                ),
                                shape = androidx.compose.foundation.shape.CircleShape,
                            ) {
                                Text("Stop room")
                            }
                        } else if (state.joined) {
                            Text(
                                state.title.ifBlank { "Connected" },
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.W800,
                                color = MaterialTheme.colorScheme.onSurface,
                                textAlign = TextAlign.Center,
                            )
                            Text(
                                state.artist,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(
                                "${state.members} listening",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(14.dp))
                            Button(
                                onClick = { Together.leave() },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.error,
                                ),
                                shape = androidx.compose.foundation.shape.CircleShape,
                            ) {
                                Text("Leave room")
                            }
                        } else {
                            Text(
                                "Create a room to share your playback, or join a friend's room.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center,
                            )
                            Spacer(Modifier.height(16.dp))
                            Button(
                                onClick = {
                                    Together.startHosting(
                                        current?.title ?: "Chordless",
                                        current?.artist.orEmpty(),
                                    )
                                },
                                shape = androidx.compose.foundation.shape.CircleShape,
                            ) {
                                Text("Create room")
                            }
                        }
                        state.error?.let {
                            Spacer(Modifier.height(10.dp))
                            Text(
                                it,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error,
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }

            if (!state.hosting && !state.joined) {
                item {
                    SectionHeading("Join a room")
                }
                item {
                    GlassPanel(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(18.dp)) {
                            OutlinedTextField(
                                value = address,
                                onValueChange = { address = it },
                                label = { Text("Host address") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(10.dp))
                            OutlinedTextField(
                                value = port,
                                onValueChange = { port = it.filter { c -> c.isDigit() } },
                                label = { Text("Port") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(10.dp))
                            OutlinedTextField(
                                value = code,
                                onValueChange = { code = it.uppercase().take(6) },
                                label = { Text("Room code") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(14.dp))
                            Button(
                                onClick = {
                                    Together.join(
                                        address.trim(),
                                        port.toIntOrNull() ?: 38000,
                                        code.trim().uppercase(),
                                    )
                                },
                                enabled = code.trim().length >= 4,
                                shape = androidx.compose.foundation.shape.CircleShape,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text("Join room")
                            }
                        }
                    }
                }
            }
        }
    }
}
