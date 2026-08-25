package uz.menora.printagent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

// Прямые вызовы Supabase REST (PostgREST) + Auth через обычный
// HttpURLConnection — без официального Supabase SDK, которого нет
// удобной чистой Java-версии для сборки без Gradle/Maven. Тот же принцип
// авторизации, что в Windows-агенте: логин владельца кабинета даёт JWT,
// и уже под этим JWT работают политики RLS на orders/order_items.
public class SupabaseClient {

    public static class AuthException extends Exception {
        public AuthException(String m) { super(m); }
    }

    private String accessToken;
    private final String email;
    private final String password;

    public SupabaseClient(String email, String password) {
        this.email = email;
        this.password = password;
    }

    public void login() throws IOException, AuthException {
        JSONObject body = new JSONObject();
        try {
            body.put("email", email);
            body.put("password", password);
        } catch (Exception ignored) {}

        HttpURLConnection conn = open("/auth/v1/token?grant_type=password", "POST");
        writeBody(conn, body.toString());
        int code = conn.getResponseCode();
        String resp = readStream(code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream());
        if (code < 200 || code >= 300) {
            throw new AuthException("Не удалось войти в кабинет (" + code + "): " + resp);
        }
        try {
            accessToken = new JSONObject(resp).getString("access_token");
        } catch (Exception e) {
            throw new AuthException("Неожиданный ответ от сервера при входе");
        }
    }

    public boolean isLoggedIn() {
        return accessToken != null;
    }

    public String findVenueId(String slug) throws IOException, AuthException {
        String path = "/rest/v1/venues?slug=eq." + enc(slug) + "&select=id,name&limit=1";
        JSONArray arr = getJsonArray(path);
        if (arr.length() == 0) return null;
        try {
            return arr.getJSONObject(0).optString("id", null);
        } catch (Exception e) {
            throw new IOException("Неожиданный ответ сервера при поиске заведения");
        }
    }

    public JSONArray getPendingOrders(String venueId, String sinceIso) throws IOException, AuthException {
        String path = "/rest/v1/orders?venue_id=eq." + enc(venueId)
                + "&printed_at=is.null&created_at=gte." + enc(sinceIso)
                + "&select=*&order=created_at.asc";
        return getJsonArray(path);
    }

    public JSONArray getOrderItems(String orderId) throws IOException, AuthException {
        String path = "/rest/v1/order_items?order_id=eq." + enc(orderId) + "&select=*";
        return getJsonArray(path);
    }

    public void markPrinted(String orderId, String nowIso) throws IOException, AuthException {
        JSONObject body = new JSONObject();
        try { body.put("printed_at", nowIso); } catch (Exception ignored) {}
        HttpURLConnection conn = open("/rest/v1/orders?id=eq." + enc(orderId), "PATCH");
        conn.setRequestProperty("Prefer", "return=minimal");
        writeBody(conn, body.toString());
        int code = conn.getResponseCode();
        if (code < 200 || code >= 300) {
            throw new AuthException("Не удалось отметить заказ напечатанным (" + code + ")");
        }
    }

    // --- внутреннее ---

    private JSONArray getJsonArray(String path) throws IOException, AuthException {
        HttpURLConnection conn = open(path, "GET");
        int code = conn.getResponseCode();
        if (code == 401) {
            accessToken = null;
            throw new AuthException("Сессия истекла, нужен повторный вход");
        }
        String resp = readStream(code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream());
        if (code < 200 || code >= 300) {
            throw new IOException("Ошибка запроса (" + code + "): " + resp);
        }
        try {
            return new JSONArray(resp);
        } catch (Exception e) {
            throw new IOException("Неожиданный ответ сервера: " + resp);
        }
    }

    private HttpURLConnection open(String pathAndQuery, String method) throws IOException, AuthException {
        if (accessToken == null && !pathAndQuery.startsWith("/auth/")) {
            throw new AuthException("Нет активной сессии");
        }
        URL url = new URL(Config.SUPABASE_URL + pathAndQuery);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("apikey", Config.SUPABASE_ANON_KEY);
        conn.setRequestProperty("Content-Type", "application/json");
        if (accessToken != null) {
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
        }
        if (method.equals("POST") || method.equals("PATCH")) {
            conn.setDoOutput(true);
        }
        return conn;
    }

    private static void writeBody(HttpURLConnection conn, String json) throws IOException {
        byte[] data = json.getBytes(StandardCharsets.UTF_8);
        conn.setFixedLengthStreamingMode(data.length);
        OutputStream os = conn.getOutputStream();
        os.write(data);
        os.flush();
        os.close();
    }

    private static String readStream(InputStream is) throws IOException {
        if (is == null) return "";
        BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }

    private static String enc(String s) {
        try {
            return URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }
}
