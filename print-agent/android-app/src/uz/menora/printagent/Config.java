package uz.menora.printagent;

import android.content.Context;
import android.content.SharedPreferences;

// Menora — единая облачная база на одном Supabase-проекте для всех
// заведений, поэтому URL и публичный (anon) ключ одни и те же для каждого
// клиента — их не нужно спрашивать у владельца заведения (тот же подход,
// что в Windows-агенте: print-agent/agent.js).
public class Config {
    public static final String SUPABASE_URL = "https://kgfmjzeegkkeizuhsycz.supabase.co";
    public static final String SUPABASE_ANON_KEY = "sb_publishable_tG8FIJiiZHuqy48PPGfT_w_oQKCqjo4";

    private static final String PREFS = "menora_print_config";

    public final String email;
    public final String password;
    public final String venueSlug;
    public final String usbDeviceKey; // UsbDevice.getDeviceName(), напр. "/dev/bus/usb/001/002"
    public final String charset; // "CP866" или "WIN1251"

    private Config(String email, String password, String venueSlug, String usbDeviceKey, String charset) {
        this.email = email;
        this.password = password;
        this.venueSlug = venueSlug;
        this.usbDeviceKey = usbDeviceKey;
        this.charset = charset;
    }

    public boolean isComplete() {
        return notEmpty(email) && notEmpty(password) && notEmpty(venueSlug) && notEmpty(usbDeviceKey);
    }

    private static boolean notEmpty(String s) {
        return s != null && s.length() > 0;
    }

    public static Config load(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new Config(
                p.getString("email", ""),
                p.getString("password", ""),
                p.getString("venueSlug", ""),
                p.getString("usbDeviceKey", ""),
                // WIN1251 по умолчанию — на реальном тесте с бюджетным USB-OTG
                // принтером эта кодировка сработала, а CP866 (по умолчанию в
                // Windows-версии на другом железе) — нет.
                p.getString("charset", "WIN1251"));
    }

    public static void save(Context ctx, String email, String password, String venueSlug, String usbDeviceKey, String charset) {
        SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        e.putString("email", email);
        e.putString("password", password);
        e.putString("venueSlug", venueSlug);
        e.putString("usbDeviceKey", usbDeviceKey);
        e.putString("charset", charset);
        e.apply();
    }
}
