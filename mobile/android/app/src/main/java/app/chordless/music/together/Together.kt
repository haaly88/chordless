package app.chordless.music.together

import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.routing.routing
import io.ktor.server.websocket.WebSockets
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Locale
import kotlin.random.Random
import kotlin.time.Duration.Companion.seconds

/**
 * Native Listen Together.
 *
 * The host runs a small Ktor websocket server on the local network; guests
 * join with the room code and receive whatever the host is playing.
 */
object Together {

    data class State(
        val hosting: Boolean = false,
        val joined: Boolean = false,
        val code: String = "",
        val address: String = "",
        val port: Int = 0,
        val members: Int = 0,
        val title: String = "",
        val artist: String = "",
        val positionMs: Long = 0,
        val error: String? = null,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder().pingInterval(20, java.util.concurrent.TimeUnit.SECONDS).build()

    private var engine: io.ktor.server.engine.EmbeddedServer<*, *>? = null
    private val sessions = java.util.Collections.synchronizedList(mutableListOf<io.ktor.server.websocket.WebSocketSession>())
    private var socket: WebSocket? = null

    private val _state = MutableStateFlow(State())
    val state = _state.asStateFlow()

    // ---------- host ----------

    fun startHosting(title: String, artist: String) {
        if (engine != null) return
        val code = randomCode()
        var port = 0
        var server: io.ktor.server.engine.EmbeddedServer<*, *>? = null
        var candidate = Random.nextInt(38000, 46000)
        repeat(12) {
            if (server != null) return@repeat
            try {
                val s = embeddedServer(Netty, port = candidate) {
                    install(WebSockets) {
                        pingPeriod = 20.seconds
                        timeout = 60.seconds
                    }
                    routing {
                        webSocket("/room/$code") {
                            sessions.add(this)
                            _state.value = _state.value.copy(members = sessions.size)
                            try {
                                outgoing.send(Frame.Text(payload()))
                                for (frame in incoming) {
                                    if (frame is Frame.Text) {
                                        val text = frame.readText()
                                        if (text.startsWith("HELLO")) {
                                            outgoing.send(Frame.Text(payload()))
                                        }
                                    }
                                }
                            } catch (_: Exception) {
                            } finally {
                                sessions.remove(this)
                                _state.value = _state.value.copy(members = sessions.size)
                            }
                        }
                    }
                }
                s.start(wait = false)
                server = s
                port = candidate
            } catch (e: Exception) {
                candidate = Random.nextInt(38000, 46000)
            }
        }
        if (server == null) {
            _state.value = _state.value.copy(error = "Could not start the room server")
            return
        }
        engine = server
        _state.value = State(
            hosting = true,
            code = code,
            address = localAddress(),
            port = port,
            members = 0,
            title = title,
            artist = artist,
        )
        // Keep the room state fresh for late joiners.
        scope.launch {
            while (engine != null) {
                kotlinx.coroutines.delay(2000)
                broadcast(payload())
            }
        }
    }

    /** Publish the currently playing track to everyone in the room. */
    fun publish(title: String, artist: String, positionMs: Long) {
        _state.value = _state.value.copy(title = title, artist = artist, positionMs = positionMs)
        if (engine != null) broadcast(payload())
    }

    fun stopHosting() {
        engine?.stop(100, 500)
        engine = null
        sessions.clear()
        _state.value = State()
    }

    // ---------- guest ----------

    fun join(address: String, port: Int, code: String) {
        if (socket != null) return
        val url = "ws://$address:$port/room/$code"
        val request = Request.Builder().url(url).build()
        socket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _state.value = _state.value.copy(joined = true, error = null, address = address, port = port, code = code)
                webSocket.send("HELLO")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                applyPayload(text)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _state.value = _state.value.copy(joined = false, error = t.message ?: "Connection lost")
            }
        })
    }

    fun leave() {
        socket?.close(1000, "bye")
        socket = null
        _state.value = _state.value.copy(joined = false)
    }

    // ---------- helpers ----------

    private fun payload(): String {
        val s = _state.value
        return "STATE|${s.title}|${s.artist}|${s.positionMs}|${s.members}"
    }

    private fun applyPayload(text: String) {
        val parts = text.split("|")
        if (parts.size < 5 || parts[0] != "STATE") return
        _state.value = _state.value.copy(
            title = parts[1],
            artist = parts[2],
            positionMs = parts[3].toLongOrNull() ?: 0L,
            members = parts[4].toIntOrNull() ?: 0,
        )
    }

    private fun broadcast(text: String) {
        val copy = synchronized(sessions) { sessions.toList() }
        scope.launch {
            copy.forEach { session ->
                runCatching { session.send(Frame.Text(text)) }
            }
        }
    }

    private fun randomCode(): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return (1..6).map { chars[Random.nextInt(chars.length)] }.joinToString("")
    }

    /** Best guess at the LAN address other devices can reach. */
    private fun localAddress(): String {
        return runCatching {
            NetworkInterface.getNetworkInterfaces().toList()
                .filter { it.isUp && !it.isLoopback }
                .flatMap { it.inetAddresses.toList() }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress }
                ?.hostAddress ?: "127.0.0.1"
        }.getOrDefault("127.0.0.1").lowercase(Locale.US)
    }
}
