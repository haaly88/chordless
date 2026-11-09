package app.chordless.music.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.prefs by preferencesDataStore(name = "chordless")

private const val KEY_GL = "gl"
private const val KEY_HL = "hl"
private const val KEY_THEME = "theme"
private const val KEY_FAVS = "favorites"

object Prefs {
    private val GL = stringPreferencesKey(KEY_GL)
    private val HL = stringPreferencesKey(KEY_HL)
    private val THEME = stringPreferencesKey(KEY_THEME)
    private val FAVS = stringSetPreferencesKey(KEY_FAVS)

    suspend fun gl(ctx: Context): String = ctx.prefs.data.map { it[GL] ?: "ID" }.first()
    suspend fun hl(ctx: Context): String = ctx.prefs.data.map { it[HL] ?: "en" }.first()
    suspend fun theme(ctx: Context): String = ctx.prefs.data.map { it[THEME] ?: "system" }.first()
    suspend fun favorites(ctx: Context): Set<String> = ctx.prefs.data.map { it[FAVS] ?: emptySet() }.first()

    suspend fun setGl(ctx: Context, v: String) = ctx.prefs.edit { it[GL] = v }
    suspend fun setHl(ctx: Context, v: String) = ctx.prefs.edit { it[HL] = v }
    suspend fun setTheme(ctx: Context, v: String) = ctx.prefs.edit { it[THEME] = v }
    suspend fun setFavorite(ctx: Context, id: String, fav: Boolean) = ctx.prefs.edit {
        val cur = (it[FAVS] ?: emptySet()).toMutableSet()
        if (fav) cur.add(id) else cur.remove(id)
        it[FAVS] = cur
    }
}
