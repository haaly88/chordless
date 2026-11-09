package app.chordless.music.player

import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionInfo

/** Media3 session service — exposes PlayerManager.player to the system
 * (notifications, lock screen, Bluetooth, Android Auto). */
class PlaybackService : MediaSessionService() {
    private var mediaSession: MediaSession? = null

    override fun onGetSession(controllerInfo: SessionInfo): MediaSession? {
        if (mediaSession == null) {
            mediaSession = MediaSession.Builder(this, PlayerManager.player).build()
        }
        return mediaSession
    }

    override fun onDestroy() {
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }
}
