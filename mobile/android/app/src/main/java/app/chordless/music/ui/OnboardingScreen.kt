package app.chordless.music.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.chordless.music.R

private data class Page(
    val image: Int,
    val title: String,
    val body: String,
)

private val pages = listOf(
    Page(
        R.drawable.onboarding_1,
        "Every song, beautifully",
        "Chordless streams straight from YouTube Music — no account, no ads, no compromises.",
    ),
    Page(
        R.drawable.onboarding_2,
        "Synced lyrics",
        "Word-by-word lyrics with karaoke highlighting, plus instant translation to 100+ languages.",
    ),
    Page(
        R.drawable.onboarding_3,
        "Built for your ears",
        "Five-band EQ, loudness normalisation, crossfade and sleep timer — tuned to your taste.",
    ),
    Page(
        R.drawable.onboarding_4,
        "Listen anywhere",
        "Download tracks for offline listening and sync playback with friends over Listen Together.",
    ),
)

/** First-run walkthrough. */
@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    var index by remember { mutableStateOf(0) }
    val page = pages[index]
    val last = index == pages.lastIndex

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background),
    ) {
        Image(
            painter = painterResource(page.image),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.35f to Color.Black.copy(alpha = 0.25f),
                        1f to Color.Black.copy(alpha = 0.88f),
                    )
                )
        )
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 30.dp, vertical = 44.dp),
            verticalArrangement = Arrangement.Bottom,
        ) {
            Text(
                page.title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.W900,
                color = Color.White,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                page.body,
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.82f),
            )
            Spacer(Modifier.height(22.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    pages.indices.forEach { i ->
                        Box(
                            modifier = Modifier
                                .size(if (i == index) 10.dp else 7.dp)
                                .clip(CircleShape)
                                .background(
                                    if (i == index) Color.White else Color.White.copy(alpha = 0.35f)
                                )
                        )
                    }
                }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = { if (last) onDone() else index++ },
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                    shape = CircleShape,
                    modifier = Modifier.height(52.dp),
                ) {
                    Text(
                        if (last) "Start listening" else "Next",
                        color = Color.Black,
                        fontWeight = FontWeight.W800,
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
            }
        }
    }
}
