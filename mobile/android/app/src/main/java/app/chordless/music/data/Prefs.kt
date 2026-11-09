package app.chordless.music.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.prefs by preferencesDataStore(name = "chordless")

object Prefs {
    private val K_GL = stringPreferencesKey("gl")
    private val K_HL = stringPreferencesKey("hl")
    private val K_THEME = stringPreferencesKey("theme")
    private val K_LANG = stringPreferencesKey("lang")
    private val K_ACCENT = stringPreferencesKey("accent")
    private val K_UISCALE = floatPreferencesKey("uiScale")
    private val K_AUTOPLAY = booleanPreferencesKey("autoplay")
    private val K_NORMALIZE = booleanPreferencesKey("normalize")
    private val K_SPONSOR = booleanPreferencesKey("sponsorSkip")
    private val K_NOTIFY = booleanPreferencesKey("notify")
    private val K_SPEED = floatPreferencesKey("speed")
    private val K_EQ = stringPreferencesKey("eq")
    private val K_EQON = booleanPreferencesKey("eqOn")

    suspend fun gl(ctx: Context): String = ctx.prefs.data.map { it[K_GL] ?: "ID" }.first()
    suspend fun hl(ctx: Context): String = ctx.prefs.data.map { it[K_HL] ?: "en" }.first()
    suspend fun theme(ctx: Context): String = ctx.prefs.data.map { it[K_THEME] ?: "dark" }.first()
    suspend fun lang(ctx: Context): String = ctx.prefs.data.map { it[K_LANG] ?: "en" }.first()
    suspend fun accent(ctx: Context): String = ctx.prefs.data.map { it[K_ACCENT] ?: "red" }.first()
    suspend fun uiScale(ctx: Context): Float = ctx.prefs.data.map { it[K_UISCALE] ?: 1.0f }.first()
    suspend fun autoplay(ctx: Context): Boolean = ctx.prefs.data.map { it[K_AUTOPLAY] ?: true }.first()
    suspend fun normalize(ctx: Context): Boolean = ctx.prefs.data.map { it[K_NORMALIZE] ?: false }.first()
    suspend fun sponsorSkip(ctx: Context): Boolean = ctx.prefs.data.map { it[K_SPONSOR] ?: true }.first()
    suspend fun notify(ctx: Context): Boolean = ctx.prefs.data.map { it[K_NOTIFY] ?: false }.first()
    suspend fun speed(ctx: Context): Float = ctx.prefs.data.map { it[K_SPEED] ?: 1f }.first()
    suspend fun eq(ctx: Context): String = ctx.prefs.data.map { it[K_EQ] ?: "0,0,0,0,0" }.first()
    suspend fun eqOn(ctx: Context): Boolean = ctx.prefs.data.map { it[K_EQON] ?: true }.first()

    suspend fun setGl(ctx: Context, v: String) = ctx.prefs.edit { it[K_GL] = v }
    suspend fun setHl(ctx: Context, v: String) = ctx.prefs.edit { it[K_HL] = v }
    suspend fun setTheme(ctx: Context, v: String) = ctx.prefs.edit { it[K_THEME] = v }
    suspend fun setLang(ctx: Context, v: String) = ctx.prefs.edit { it[K_LANG] = v }
    suspend fun setAccent(ctx: Context, v: String) = ctx.prefs.edit { it[K_ACCENT] = v }
    suspend fun setUiScale(ctx: Context, v: Float) = ctx.prefs.edit { it[K_UISCALE] = v }
    suspend fun setAutoplay(ctx: Context, v: Boolean) = ctx.prefs.edit { it[K_AUTOPLAY] = v }
    suspend fun setNormalize(ctx: Context, v: Boolean) = ctx.prefs.edit { it[K_NORMALIZE] = v }
    suspend fun setSponsorSkip(ctx: Context, v: Boolean) = ctx.prefs.edit { it[K_SPONSOR] = v }
    suspend fun setNotify(ctx: Context, v: Boolean) = ctx.prefs.edit { it[K_NOTIFY] = v }
    suspend fun setSpeed(ctx: Context, v: Float) = ctx.prefs.edit { it[K_SPEED] = v }
    suspend fun setEq(ctx: Context, v: String) = ctx.prefs.edit { it[K_EQ] = v }
    suspend fun setEqOn(ctx: Context, v: Boolean) = ctx.prefs.edit { it[K_EQON] = v }

    fun themeFlow(ctx: Context): kotlinx.coroutines.flow.Flow<String> =
        ctx.prefs.data.map { it[K_THEME] ?: "system" }
    fun accentFlow(ctx: Context): kotlinx.coroutines.flow.Flow<String> =
        ctx.prefs.data.map { it[K_ACCENT] ?: "red" }
    fun uiScaleFlow(ctx: Context): kotlinx.coroutines.flow.Flow<Float> =
        ctx.prefs.data.map { it[K_UISCALE] ?: 1.0f }
}
