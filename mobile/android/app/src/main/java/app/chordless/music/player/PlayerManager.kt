package app.chordless.music.player

import android.app.Application
import android.content.Context
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import app.chordless.music.data.Innertube
import app.chordless.music.data.LocalStore
import app.chordless.music.data.Prefs
import app.chordless.music.data.SponsorBlockRepo
import app.chordless.music.data.Track
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Shared playback state + queue. The ExoPlayer instance is owned here
 * so the UI and notification all drive the same player.
 */
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

    private val _shuffle = MutableStateFlow(false)
    val shuffle: StateFlow<Boolean> = _shuffle.asStateFlow()

    private val _repeat = MutableStateFlow(0) // 0 off, 1 all, 2 one
    val repeat: StateFlow<Int> = _repeat.asStateFlow()

    private val _speed = MutableStateFlow(1f)
    val speed: StateFlow<Float> = _speed.asStateFlow()

    private val _sleepEndsAt = MutableStateFlow<Long?>(null)
    val sleepEndsAt: StateFlow<Long?> = _sleepEndsAt.asStateFlow()

    private val _sleepRemainingSec = MutableStateFlow<Long?>(null)
    val sleepRemainingSec: StateFlow<Long?> = _sleepRemainingSec.asStateFlow()

    private var ctx: Context? = null
    @Volatile
    private var segments: List<Pair<Long, Long>> = emptyList()
    @Volatile
    private var sponsorSkip = true
    @Volatile
    private var autoplay = true
    @Volatile
    private var eq: Equalizer? = null
    @Volatile
    private var enhancer: LoudnessEnhancer? = null
    @Volatile
    private var crossfade: Float = 0.5f
    /** codec/bitrate of the currently playing stream (stats for nerds). */
    private var currentFormat: String = ""

    /** Volume the user picked (before the crossfade ramp is applied). */
    private var userVolume: Float = 1f

    /** Current crossfade attenuation factor, 1f = no attenuation. */
    private var fadeFactor: Float = 1f

    /** Wall-clock moment the current item started playing (for the fade-in). */
    private var itemStartedAt: Long = 0L

    /** Stream candidates for the current track, best first. */
    private var streamCandidates: List<app.chordless.music.data.Streams.Resolved> = emptyList()

    /** Index of the candidate currently in use. */
    private var streamCandidateIndex: Int = 0

    /**
     * Crossfade via volume ramp: fades out during the last N ms of a track and
     * fades in during the first N ms of the next one. Media3 has no native
     * crossfade API, so this is the closest equivalent.
     *
     * The fade-in is measured from the moment playback actually started (wall
     * clock), never from the player position — the position stays at zero while
     * a stream is still buffering and would silence the track.
     */
    private fun updateCrossfade() {
        if (!::player.isInitialized) return
        val ms = (crossfade * 1000).toInt()
        val target = if (ms <= 0) {
            1f
        } else {
            val pos = player.currentPosition
            val dur = player.duration
            val remaining = if (dur > 0) dur - pos else Long.MAX_VALUE
            val elapsed = android.os.SystemClock.elapsedRealtime() - itemStartedAt
            when {
                remaining <= ms -> (remaining.toFloat() / ms).coerceIn(0f, 1f)
                elapsed <= ms -> (elapsed.toFloat() / ms).coerceIn(0f, 1f)
                else -> 1f
            }
        }
        if (kotlin.math.abs(target - fadeFactor) < 0.01f) return
        fadeFactor = target
        player.volume = (userVolume * target).coerceIn(0f, 1f)
    }

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
                retryWithNextStream(error)
            }

            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) {
                    _loading.value = false
                    _error.value = null
                    itemStartedAt = android.os.SystemClock.elapsedRealtime()
                    attachFx()
                } else if (state == Player.STATE_BUFFERING) {
                    _loading.value = true
                } else if (state == Player.STATE_ENDED) {
                    onTrackEnded()
                }
            }
        })
        // ticker: position + sleep countdown + sponsor skip
        scope.launch {
            while (true) {
                delay(250)
                if (::player.isInitialized) _positionMs.value = player.currentPosition
                updateCrossfade()
                val endsAt = _sleepEndsAt.value
                if (endsAt != null && endsAt > 0) {
                    val remaining = ((endsAt - System.currentTimeMillis()) / 1000).coerceAtLeast(0)
                    _sleepRemainingSec.value = remaining
                    if (remaining <= 0) {
                        setSleep(null)
                        if (::player.isInitialized) player.pause()
                    }
                }
                if (::player.isInitialized && sponsorSkip && segments.isNotEmpty()) {
                    val pos = player.currentPosition
                    val seg = segments.firstOrNull { pos >= it.first && pos < it.second }
                    if (seg != null) player.seekTo(seg.second)
                }
            }
        }
        // load prefs
        scope.launch {
            val c = ctx ?: return@launch
            sponsorSkip = Prefs.sponsorSkip(c)
            autoplay = Prefs.autoplay(c)
            crossfade = Prefs.crossfade(c)
            _speed.value = Prefs.speed(c)
            player.setPlaybackSpeed(_speed.value)
            applyEqFromPrefs()
        }
    }

    // ---------- EQ / loudness ----------
    private fun attachFx() {
        val sessionId = try {
            player.audioSessionId
        } catch (e: Exception) {
            0
        }
        if (sessionId == 0) return
        try {
            if (eq == null) eq = Equalizer(0, sessionId)
            if (enhancer == null) enhancer = LoudnessEnhancer(sessionId)
            applyEqFromPrefs()
        } catch (e: Exception) {
            // audiofx unavailable on this device — ignore
        }
    }

    private fun applyEqFromPrefs() {
        val c = ctx ?: return
        scope.launch(Dispatchers.IO) {
            val gains = Prefs.eq(c).split(",").mapNotNull { it.toFloatOrNull() }
            val on = Prefs.eqOn(c)
            val normalize = Prefs.normalize(c)
            withContext(Dispatchers.Main) {
                try {
                    eq?.let { fx ->
                        fx.enabled = on
                        val bands = fx.numberOfBands.toInt()
                        for (i in 0 until bands) {
                            val g = gains.getOrNull(i) ?: 0f
                            val mb = (g * 100).toInt().coerceIn(fx.bandLevelRange[0].toInt(), fx.bandLevelRange[1].toInt())
                            fx.setBandLevel(i.toShort(), mb.toShort())
                        }
                    }
                    enhancer?.enabled = normalize
                } catch (e: Exception) {
                    // ignore
                }
            }
        }
    }

    fun refreshFx() = applyEqFromPrefs()

    // ---------- playback ----------

    /** Resolve stream URL (NewPipe) and start playback for [track]. */
    fun play(track: Track, queue: List<Track> = emptyList()) {
        if (!::player.isInitialized) return
        if (queue.isNotEmpty()) {
            val found = queue.indexOfFirst { it.id == track.id }
            if (found >= 0) {
                _queue.value = queue
                _index.value = found
            } else {
                // requested track missing from supplied queue (e.g. restored UI)
                _queue.value = listOf(track)
                _index.value = 0
            }
        } else if (track.id != _current.value?.id) {
            _queue.value = listOf(track)
            _index.value = 0
        }
        _current.value = track
        _loading.value = true
        _error.value = null
        segments = emptyList()
        scope.launch(Dispatchers.IO) {
            try {
                val candidates = app.chordless.music.data.Streams.resolveCandidates(track.id)
                withContext(Dispatchers.Main) {
                    streamCandidates = candidates
                    streamCandidateIndex = 0
                    applyCandidate(candidates[0], track)
                    ctx?.let {
                        LocalStore.recordPlay(it, track)
                        PlaybackService.start(it)
                    }
                }
                if (sponsorSkip && _current.value?.id == track.id) {
                    segments = SponsorBlockRepo.segments(track.id)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    _loading.value = false
                    _error.value = "Could not load audio: ${e.message}"
                }
            }
        }
    }

    /** Start playback of a resolved stream candidate. */
    private fun applyCandidate(resolved: app.chordless.music.data.Streams.Resolved, track: Track) {
        currentFormat = listOf(
            resolved.mime.ifBlank { null },
            resolved.bitrate.takeIf { it > 0 }?.let { "$it kbps" },
        ).filterNotNull().joinToString(" · ")
        itemStartedAt = android.os.SystemClock.elapsedRealtime()
        fadeFactor = 1f
        player.volume = userVolume
        player.setMediaItem(MediaItem.Builder().setUri(resolved.url).setMediaId(track.id).build())
        player.prepare()
        player.play()
    }

    /**
     * A signed media URL can be rejected by YouTube even seconds after it was
     * resolved. Walk to the next candidate instead of giving up.
     */
    private fun retryWithNextStream(error: PlaybackException) {
        val next = streamCandidateIndex + 1
        if (next < streamCandidates.size) {
            streamCandidateIndex = next
            _loading.value = true
            _error.value = null
            val track = _current.value
            scope.launch {
                delay(600)
                withContext(Dispatchers.Main) {
                    if (track != null) applyCandidate(streamCandidates[next], track)
                }
            }
        } else {
            _loading.value = false
            _error.value = "Could not play this track (${error.errorCodeName}). Tap play to retry."
        }
    }

    /** Play a track from the offline (downloaded) library. */
    fun playLocal(file: java.io.File, track: Track) {
        if (!::player.isInitialized) return
        _current.value = track
        _loading.value = true
        _error.value = null
        streamCandidates = emptyList()
        currentFormat = "Offline · ${file.length() / 1024} KB"
        itemStartedAt = android.os.SystemClock.elapsedRealtime()
        player.setMediaItem(MediaItem.Builder().setUri(file.toURI().toString()).setMediaId(track.id).build())
        player.prepare()
        player.play()
        _loading.value = false
        ctx?.let { context ->
            PlaybackService.start(context)
            scope.launch { LocalStore.recordPlay(context, track) }
        }
    }

    fun toggle() {
        if (::player.isInitialized) {
            if (player.isPlaying) player.pause() else player.play()
            ctx?.let { PlaybackService.start(it) }
        }
    }

    fun seekTo(ms: Long) {
        if (::player.isInitialized) player.seekTo(ms)
    }

    fun setSpeed(v: Float) {
        _speed.value = v
        if (::player.isInitialized) player.setPlaybackSpeed(v)
        ctx?.let { c -> scope.launch { Prefs.setSpeed(c, v) } }
    }

    fun setVolume(v: Float) {
        userVolume = v.coerceIn(0f, 1f)
        if (::player.isInitialized) {
            player.volume = (userVolume * fadeFactor).coerceIn(0f, 1f)
        }
    }

    fun setShuffle(on: Boolean) {
        _shuffle.value = on
    }

    fun setRepeat(mode: Int) {
        _repeat.value = mode
        if (!::player.isInitialized) return
        player.repeatMode = when (mode) {
            1 -> Player.REPEAT_MODE_ALL
            2 -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    fun next(manual: Boolean = false) {
        val q = _queue.value
        if (q.isEmpty()) return
        val n = if (_shuffle.value && q.size > 1) {
            var r = (q.indices).random()
            while (r == _index.value) r = q.indices.random()
            r
        } else {
            (_index.value + 1) % q.size
        }
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

    private fun onTrackEnded() {
        if (_sleepEndsAt.value == -1L) {
            // sleep timer: end of current track
            setSleep(null)
            if (::player.isInitialized) player.pause()
            return
        }
        when (repeatMode()) {
            2 -> _current.value?.let { play(it) } // repeat one
            1 -> {
                val q = _queue.value
                if (q.isEmpty()) return
                if (_index.value < q.lastIndex) next()
                else {
                    _index.value = 0
                    play(q[0], q)
                }
            }
            else -> {
                if (_index.value < _queue.value.lastIndex) {
                    next()
                } else if (autoplay) {
                    autoplayNext()
                }
            }
        }
    }

    private fun repeatMode(): Int = _repeat.value

    // ---------- Radio: search similar and continue ----------
    private fun autoplayNext() {
        val t = _current.value ?: return
        val query = t.artist.ifBlank { t.title }
        if (query.isBlank()) return
        scope.launch(Dispatchers.IO) {
            try {
                val c = ctx ?: return@launch
                val gl = Prefs.gl(c)
                val hl = Prefs.hl(c)
                val results = Innertube.search(query, 10, gl, hl)
                    .filter { it.id != t.id && (it.kind == "song" || it.kind == "track" || it.kind == "video") }
                if (results.isEmpty()) return@launch
                withContext(Dispatchers.Main) {
                    val cur = _queue.value.toMutableList()
                    cur.addAll(results)
                    // cap queue growth (drop oldest, keep autoplay window)
                    val overflow = (cur.size - 100).coerceAtLeast(0)
                    if (overflow > 0) repeat(overflow) { cur.removeAt(0) }
                    _queue.value = cur
                    _index.value = (cur.size - results.size).coerceAtLeast(0)
                    play(results.first(), cur)
                }
            } catch (e: Exception) {
                // autoplay failed — stay idle
            }
        }
    }

    // ---------- queue ops ----------

    fun playNextInQueue(track: Track) {
        val cur = _queue.value.toMutableList()
        cur.add((_index.value + 1).coerceAtMost(cur.size), track)
        _queue.value = cur
    }

    fun addToQueue(track: Track) {
        _queue.value = _queue.value + track
    }

    fun removeFromQueue(idx: Int) {
        val cur = _queue.value.toMutableList()
        if (idx !in cur.indices) return
        val removedCurrent = idx == _index.value
        cur.removeAt(idx)
        _queue.value = cur
        if (cur.isEmpty()) {
            _index.value = 0
            _current.value = null
            if (::player.isInitialized) player.stop()
            ctx?.let { PlaybackService.stop(it) }
            return
        }
        if (idx < _index.value) _index.value -= 1
        if (removedCurrent) {
            _index.value = idx.coerceAtMost(cur.lastIndex)
            play(cur[_index.value], cur)
        }
    }

    fun clearQueue() {
        val keep = _current.value
        _queue.value = if (keep != null) listOf(keep) else emptyList()
        _index.value = 0
    }

    // ---------- sleep timer ----------

    /** minutes: null = off, -1 = end of current track, >0 = minutes. */
    fun setSleep(minutes: Int?) {
        when {
            minutes == null -> {
                _sleepEndsAt.value = null
                _sleepRemainingSec.value = null
            }
            minutes == -1 -> {
                _sleepEndsAt.value = -1L
                _sleepRemainingSec.value = null
            }
            else -> {
                val ms = minutes * 60_000L
                _sleepEndsAt.value = System.currentTimeMillis() + ms
                _sleepRemainingSec.value = minutes * 60L
            }
        }
    }

    fun sleepChip(): String? {
        val endsAt = _sleepEndsAt.value ?: return null
        return when {
            endsAt == -1L -> "End of track"
            else -> {
                val s = _sleepRemainingSec.value ?: return null
                "%d:%02d".format(s / 60, s % 60)
            }
        }
    }

    fun safePause() {
        if (::player.isInitialized) player.pause()
    }

    fun durationMs(): Long = if (::player.isInitialized) player.duration.coerceAtLeast(0) else 0
    fun positionNow(): Long = if (::player.isInitialized) player.currentPosition else 0

    /** Stats-for-nerds line (BitChord parity): codec · bitrate of the stream. */
    fun statsLine(): String = currentFormat.ifBlank { "Streaming" }

    @Suppress("unused")
    private val seekWindow = C.DEFAULT_SEEK_BACK_INCREMENT_MS
}