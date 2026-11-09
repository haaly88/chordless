package app.chordless.music;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import java.util.concurrent.TimeUnit;

/**
 * Native InnerTube bridge for Chordless. WebView fetch cannot reach
 * music.youtube.com (CORS + bot detection), so this plugin performs the
 * same POST requests from native Android (OkHttp), bypassing CORS entirely.
 * Returns the raw InnerTube JSON body to the web layer for parsing.
 */
@CapacitorPlugin(name = "InnerTube")
public class InnerTubePlugin extends Plugin {

    private static final String YT_BASE = "https://music.youtube.com/youtubei/v1";
    private static final String CLIENT_NAME = "WEB_REMIX";
    private static final String CLIENT_VERSION = "1.20251112.01.00";

    private final OkHttpClient client = new OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build();

    /** call: { endpoint: "search" | "browse", body: "<json object string>", gl: "ID", hl: "en" } */
    @PluginMethod
    public void post(PluginCall call) {
        String endpoint = call.getString("endpoint", "search");
        String body = call.getString("body", "{}");
        String gl = call.getString("gl", "ID");
        String hl = call.getString("hl", "en");

        String json = "{"
            + "\"context\":{\"client\":{\"clientName\":\"" + CLIENT_NAME + "\","
            + "\"clientVersion\":\"" + CLIENT_VERSION + "\","
            + "\"hl\":\"" + hl + "\",\"gl\":\"" + gl + "\"}},"
            + body.substring(1); // strip leading "{" of the caller-provided object

        Request.Builder rb = new Request.Builder()
            .url(YT_BASE + "/" + endpoint)
            .header("Content-Type", "application/json")
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")
            .header("Origin", "https://music.youtube.com")
            .header("X-YouTube-Client-Name", "67")
            .header("X-YouTube-Client-Version", CLIENT_VERSION)
            .post(RequestBody.create(json, MediaType.parse("application/json")));
        Request request = rb.build();

        new Thread(() -> {
            try (Response response = client.newCall(request).execute()) {
                ResponseBody rb2 = response.body();
                String payload = rb2 != null ? rb2.string() : "";
                if (!response.isSuccessful()) {
                    call.reject("InnerTube " + endpoint + " failed: HTTP " + response.code());
                    return;
                }
                JSObject result = new JSObject();
                result.put("json", payload);
                call.resolve(result);
            } catch (IOException e) {
                call.reject("InnerTube request failed: " + e.getMessage());
            }
        }).start();
    }
}
