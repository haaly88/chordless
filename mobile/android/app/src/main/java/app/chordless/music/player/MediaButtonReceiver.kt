package app.chordless.music.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.view.KeyEvent

/**
 * Hardware / Bluetooth media-button handling.
 *
 * The notification itself is driven by [PlaybackService]; this receiver only
 * translates raw media key events into player commands.
 */
class MediaButtonReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_MEDIA_BUTTON -> {
                val event: KeyEvent? = if (android.os.Build.VERSION.SDK_INT >= 33) {
                    intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT)
                }
                handleKey(event?.keyCode ?: return)
            }

            PlaybackService.ACTION_TOGGLE -> PlayerManager.toggle()
            PlaybackService.ACTION_NEXT -> PlayerManager.next(true)
            PlaybackService.ACTION_PREV -> PlayerManager.prev()
            PlaybackService.ACTION_STOP -> PlayerManager.safePause()
        }
    }

    private fun handleKey(keyCode: Int) {
        when (keyCode) {
            KeyEvent.KEYCODE_MEDIA_NEXT, KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> PlayerManager.next(true)
            KeyEvent.KEYCODE_MEDIA_PREVIOUS, KeyEvent.KEYCODE_MEDIA_REWIND -> PlayerManager.prev()
            KeyEvent.KEYCODE_MEDIA_PLAY -> if (!PlayerManager.isPlaying.value) PlayerManager.toggle()
            KeyEvent.KEYCODE_MEDIA_PAUSE -> if (PlayerManager.isPlaying.value) PlayerManager.toggle()
            KeyEvent.KEYCODE_MEDIA_STOP -> PlayerManager.safePause()
            KeyEvent.KEYCODE_HEADSETHOOK -> PlayerManager.toggle()
        }
    }
}
