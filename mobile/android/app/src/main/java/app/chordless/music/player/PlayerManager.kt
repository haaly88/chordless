package app.chordless.music.player

import android.app.Application
import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import app.chordless.music.data.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Shared playback state + queue. The ExoPlayer instance is owned here
 * so the UI, service and notification all drive the same player. */
object PlayerManager {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    lateinit var player: ExoPlayer
        private set

    private val _queue = MutableStateFlow<List<Track>>(emptyList())
    val queue: StateFlow<List<Track>> = _queue.asStateFlow()

    private val _index = MutableStateFlow(0)
    val index: StateFlow<Int> = _index.asStateFlow()

    private val _current = MutableStateFlow<Track?>(null)
    val current: StateFlow<Track?> = _current.asStateFlow()

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _positionMs = MutableStateFlow(0L)
    val positionMs: StateFlow<Long> = _positionMs.asStateFlow()

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private var ctx: Context? = null

    fun init(app: Application) {
        if (::player.isInitialized) return
        ctx = app
        player = ExoPlayer.Builder(app)
            .setSeekBackIncrementMs(10_000)
            .setSeekForwardIncrementMs(10_000)
            .build()
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _isPlaying.value = isPlaying
            }
            override fun onPlayerError(error: PlaybackException) {
                _loading.value = false
                _error.value = error.message
            }
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    _loading.value = false
                    _error.value = null
                } else if (state == Player.STATE_BUFFERING) {
                    _loading.value = true
                } else if (state == Player.STATE_ENDED) {
                    next()
                }
            }
        })
        // position ticker
        scope.launch {
            while (true) {
                kotlinx.coroutines.delay(500)
                _positionMs.value = player.currentPosition
            }
        }
    }

    /** Resolve stream URL (NewPipe) and start playback for [track]. */
    fun play(track: Track, queue: List<Track> = emptyList()) {
        if (queue.isNotEmpty()) {
            _queue.value = queue
            _index.value = queue.indexOfFirst { it.id == track.id }.coerceAtLeast(0)
        } else if (track.id != _current.value?.id) {
            _queue.value = listOf(track)
            _index.value = 0
        }
        _current.value = track
        _loading.value = true
        _error.value = null
        scope.launch(Dispatchers.IO) {
            try {
                val url = app.chordless.music.data.Streams.audioUrl(track.id)
                kotlinx.coroutines.withContext(Dispatchers.Main) {
                    player.setMediaItem(MediaItem.Builder().setUri(url).setMediaId(track.id).build())
                    player.prepare()
                    player.play()
                    _loading.value = false
                }
            } catch (e: Exception) {
                kotlinx.coroutines.withContext(Dispatchers.Main) {
                    _loading.value = false
                    _error.value = "Could not load audio: ${e.message}"
                }
            }
        }
    }

    fun toggle() {
        if (::player.isInitialized) {
            if (player.isPlaying) player.pause() else player.play()
        }
    }

    fun seekTo(ms: Long) {
        if (::player.isInitialized) player.seekTo(ms)
    }

    fun next() {
        val q = _queue.value
        if (q.isEmpty()) return
        val n = (_index.value + 1) % q.size
        _index.value = n
        play(q[n], q)
    }

    fun prev() {
        if (::player.isInitialized && player.currentPosition > 3_000) {
            player.seekTo(0)
            return
        }
        val q = _queue.value
        if (q.isEmpty()) return
        val n = (_index.value - 1 + q.size) % q.size
        _index.value = n
        play(q[n], q)
    }

    fun durationMs(): Long = if (::player.isInitialized) player.duration.coerceAtLeast(0) else 0
    fun positionNow(): Long = if (::player.isInitialized) player.currentPosition else 0

    val session: MediaSession? = null
    private var _mediaSession: MediaSession? = null

    class Service : MediaSessionService() {
        private var session: MediaSession? = null
        override fun onGetSession(controllerInfo: androidx.media3.session.SessionInfo): MediaSession? {
            if (session == null && ::PlayerManager.player.isInitialized) {
                session = MediaSession.Builder(this, PlayerManager.player).build()
            }
            return session
        }
        override fun onDestroy() {
            session?.release()
            session = null
            super.onDestroy()
        }
    }

    // keep C import used (seek window)
    @Suppress("unused")
    private val seekWindow = C.DEFAULT_SEEK_BACK_INCREMENT_MS
}
