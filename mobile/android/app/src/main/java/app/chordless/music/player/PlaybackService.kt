package app.chordless.music.player

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import app.chordless.music.MainActivity
import app.chordless.music.R
import app.chordless.music.data.Track

/**
 * Foreground playback service (BitChord-style background playback without
 * MediaSession): keeps the process alive and shows a media notification
 * with previous / play-pause / next actions.
 */
class PlaybackService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL, "Now playing", NotificationManager.IMPORTANCE_LOW)
            getSystemService(Context.NOTIFICATION_SERVICE)
                .let { it as NotificationManager }
                .createNotificationChannel(channel)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TOGGLE -> PlayerManager.toggle()
            ACTION_NEXT -> PlayerManager.next()
            ACTION_PREV -> PlayerManager.prev()
            ACTION_STOP -> {
                PlayerManager.player.pause()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
        }
        val track = PlayerManager.current.value
        startForeground(NOTIF_ID, buildNotification(track))
        return START_NOT_STICKY
    }

    private fun buildNotification(track: Track?): android.app.Notification {
        val pending = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        fun action(icon: Int, title: String, actionName: String): NotificationCompat.Action {
            val pi = PendingIntent.getService(
                this, actionName.hashCode(),
                Intent(this, PlaybackService::class.java).setAction(actionName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            return NotificationCompat.Action(icon, title, pi)
        }
        val isPlaying = try {
            PlayerManager.isPlaying.value
        } catch (e: Exception) {
            false
        }
        return NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle(track?.title ?: "Chordless")
            .setContentText(track?.artist ?: "")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(action(android.R.drawable.ic_media_previous, "Previous", ACTION_PREV))
            .addAction(
                action(
                    if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
                    if (isPlaying) "Pause" else "Play",
                    ACTION_TOGGLE,
                )
            )
            .addAction(action(android.R.drawable.ic_media_next, "Next", ACTION_NEXT))
            .build()
    }

    companion object {
        const val CHANNEL = "now_playing"
        const val NOTIF_ID = 1001
        const val ACTION_TOGGLE = "chordless.action.TOGGLE"
        const val ACTION_NEXT = "chordless.action.NEXT"
        const val ACTION_PREV = "chordless.action.PREV"
        const val ACTION_STOP = "chordless.action.STOP"

        fun start(ctx: Context) {
            val intent = Intent(ctx, PlaybackService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, PlaybackService::class.java))
        }
    }
}
