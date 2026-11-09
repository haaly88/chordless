package app.chordless.music.ui

import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.palette.graphics.Palette
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Dominant artwork colors for dynamic theming (Apple/BitChord-style). */
object ArtworkPalette {

    data class Colors(val dominant: Color, val dark: Color)

    /** Extract the two most useful colors from a 96px thumbnail. */
    suspend fun extract(context: android.content.Context, url: String): Colors? = withContext(Dispatchers.IO) {
        if (url.isBlank()) return@withContext null
        val loader = ImageLoader(context)
        val request = ImageRequest.Builder(context).data(url).size(96).allowHardware(false).build()
        val result = runCatching { loader.execute(request) }.getOrNull()
        val drawable = (result as? SuccessResult)?.drawable ?: return@withContext null
        val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        drawable.setBounds(0, 0, 96, 96)
        drawable.draw(canvas)
        val palette = Palette.from(bitmap).generate()
        val dominant = palette.dominantSwatch?.rgb ?: return@withContext null
        val dark = palette.darkMutedSwatch?.rgb ?: palette.darkVibrantSwatch?.rgb ?: dominant
        Colors(Color(dominant), Color(dark))
    }
}

/** Remembers the current track's artwork colors (recomputed when the cover changes). */
@Composable
fun rememberArtworkColors(coverUrl: String): ArtworkPalette.Colors? {
    val ctx = LocalContext.current
    var colors by remember { mutableStateOf<ArtworkPalette.Colors?>(null) }
    LaunchedEffect(coverUrl) {
        colors = ArtworkPalette.extract(ctx, coverUrl)
    }
    return colors
}
