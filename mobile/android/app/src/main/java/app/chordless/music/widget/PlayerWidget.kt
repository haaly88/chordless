package app.chordless.music.widget

import android.content.Context
import android.net.Uri
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.updateAll
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.layout.Row
import androidx.glance.layout.size
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.chordless.music.player.PlayerManager

/** Launcher widget with artwork and playback controls. */
class PlayerWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val track = PlayerManager.current.value
        val playing = PlayerManager.isPlaying.value
        provideContent {
            GlanceTheme {
                Column(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(ColorProvider(Color(0xFF141418)))
                        .cornerRadius(28.dp)
                        .padding(16.dp),
                    verticalAlignment = Alignment.Vertical.CenterVertically,
                    horizontalAlignment = Alignment.Horizontal.Start,
                ) {
                    Row(verticalAlignment = Alignment.Vertical.CenterVertically) {
                        Image(
                            provider = ImageProvider(app.chordless.music.R.drawable.cover_1),
                            contentDescription = null,
                            modifier = GlanceModifier.size(58.dp).cornerRadius(16.dp),
                        )
                        Column(modifier = GlanceModifier.padding(start = 12.dp)) {
                            Text(
                                text = track?.title ?: "Chordless",
                                style = TextStyle(
                                    color = ColorProvider(Color.White),
                                    fontSize = 15.sp,
                                ),
                                maxLines = 1,
                            )
                            Text(
                                text = track?.artist?.ifBlank { "Nothing playing" } ?: "Nothing playing",
                                style = TextStyle(
                                    color = ColorProvider(Color(0xFFA3A3AD)),
                                    fontSize = 12.sp,
                                ),
                                maxLines = 1,
                            )
                        }
                    }
                    Row(
                        modifier = GlanceModifier.padding(top = 10.dp),
                        horizontalAlignment = Alignment.Horizontal.End,
                    ) {
                        Text(
                            text = if (playing) "⏸" else "▶",
                            style = TextStyle(
                                color = ColorProvider(Color.White),
                                fontSize = 22.sp,
                            ),
                            modifier = GlanceModifier
                                .padding(horizontal = 10.dp)
                                .clickable(actionRunCallback<TogglePlaybackAction>()),
                        )
                        Text(
                            text = "⏭",
                            style = TextStyle(
                                color = ColorProvider(Color.White),
                                fontSize = 22.sp,
                            ),
                            modifier = GlanceModifier
                                .padding(horizontal = 10.dp)
                                .clickable(actionRunCallback<NextTrackAction>()),
                        )
                    }
                }
            }
        }
    }
}

class PlayerWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = PlayerWidget()
}

class TogglePlaybackAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: androidx.glance.action.ActionParameters) {
        PlayerManager.toggle()
        PlayerWidget().updateAll(context)
    }
}

class NextTrackAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: androidx.glance.action.ActionParameters) {
        PlayerManager.next(true)
        PlayerWidget().updateAll(context)
    }
}
