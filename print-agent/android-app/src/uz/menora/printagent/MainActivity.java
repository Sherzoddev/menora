package uz.menora.printagent;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.usb.UsbDevice;
import android.os.Build;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private EditText inputEmail, inputPassword, inputSlug;
    private Spinner spinnerPrinter, spinnerCharset;
    private TextView statusText;

    private final List<String> printerKeys = new ArrayList<>();
    private final List<String> printerLabels = new ArrayList<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(getResources().getIdentifier("activity_main", "layout", getPackageName()));

        inputEmail = findViewById(id("inputEmail"));
        inputPassword = findViewById(id("inputPassword"));
        inputSlug = findViewById(id("inputSlug"));
        spinnerPrinter = findViewById(id("spinnerPrinter"));
        spinnerCharset = findViewById(id("spinnerCharset"));
        statusText = findViewById(id("statusText"));
        Button btnRefresh = findViewById(id("btnRefreshPrinters"));
        Button btnTest = findViewById(id("btnTestPrint"));
        Button btnSave = findViewById(id("btnSaveStart"));
        Button btnStop = findViewById(id("btnStop"));

        ArrayAdapter<String> charsetAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item,
                new String[]{EscPos.CHARSET_CP866, EscPos.CHARSET_WIN1251});
        spinnerCharset.setAdapter(charsetAdapter);

        if (Build.VERSION.SDK_INT >= 33) {
            ActivityCompatRequestNotifPermission();
        }

        Config cfg = Config.load(this);
        inputEmail.setText(cfg.email);
        inputPassword.setText(cfg.password);
        inputSlug.setText(cfg.venueSlug);

        refreshPrinterList(cfg.usbDeviceKey);
        int charsetIndex = EscPos.CHARSET_WIN1251.equals(cfg.charset) ? 1 : 0;
        spinnerCharset.setSelection(charsetIndex);

        btnRefresh.setOnClickListener(v -> refreshPrinterList(null));
        btnTest.setOnClickListener(v -> onTestPrint());
        btnSave.setOnClickListener(v -> onSaveAndStart());
        btnStop.setOnClickListener(v -> {
            stopService(new Intent(this, PrintService.class));
            statusText.setText("Остановлено");
        });
    }

    private static final String PERMISSION_POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";

    private void ActivityCompatRequestNotifPermission() {
        // Строковый литерал вместо Manifest.permission.POST_NOTIFICATIONS —
        // эта константа появилась в android.jar только с API 33, а собираем
        // мы против более лёгкой платформы API 31 (сама разрешение при этом
        // существует в системе на любом устройстве, если объявлено в
        // манифесте — просто нет типобезопасной константы в этом android.jar).
        if (checkSelfPermission(PERMISSION_POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{PERMISSION_POST_NOTIFICATIONS}, 100);
        }
    }

    private int id(String name) {
        return getResources().getIdentifier(name, "id", getPackageName());
    }

    private void refreshPrinterList(String preselectKey) {
        Map<String, UsbDevice> devices = new LinkedHashMap<>(UsbPrinterBridge.listDevices(this));
        printerKeys.clear();
        printerLabels.clear();
        for (Map.Entry<String, UsbDevice> e : devices.entrySet()) {
            UsbDevice d = e.getValue();
            printerKeys.add(deviceKey(d));
            printerLabels.add(d.getProductName() != null ? d.getProductName() : e.getKey());
        }
        if (printerKeys.isEmpty()) {
            printerLabels.add("Принтер не найден — подключите USB-OTG кабель");
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, printerLabels);
        spinnerPrinter.setAdapter(adapter);
        if (preselectKey != null) {
            int idx = printerKeys.indexOf(preselectKey);
            if (idx >= 0) spinnerPrinter.setSelection(idx);
        }
    }

    // vendorId:productId вместо getDeviceName() — путь устройства
    // (/dev/bus/usb/...) может смениться после перезагрузки телефона или
    // переподключения кабеля, а вендор/модель принтера — нет.
    static String deviceKey(UsbDevice d) {
        return d.getVendorId() + ":" + d.getProductId();
    }

    private UsbDevice selectedDevice() {
        int idx = spinnerPrinter.getSelectedItemPosition();
        if (idx < 0 || idx >= printerKeys.size()) return null;
        return findByKey(this, printerKeys.get(idx));
    }

    static UsbDevice findByKey(android.content.Context ctx, String key) {
        for (UsbDevice d : UsbPrinterBridge.listDevices(ctx).values()) {
            if (deviceKey(d).equals(key)) return d;
        }
        return null;
    }

    private String selectedCharset() {
        Object item = spinnerCharset.getSelectedItem();
        return item != null ? item.toString() : EscPos.CHARSET_WIN1251;
    }

    private void onTestPrint() {
        UsbDevice device = selectedDevice();
        if (device == null) {
            statusText.setText("Выберите принтер (подключите USB-OTG кабель)");
            return;
        }
        statusText.setText("Печатаю...");
        String charset = selectedCharset();
        UsbPrinterBridge.requestPermission(this, device, granted -> {
            if (!granted) {
                runOnUiThread(() -> statusText.setText("Нет разрешения на доступ к USB-устройству"));
                return;
            }
            new Thread(() -> {
                try {
                    byte[] ticket = PrintService.buildTicket("ТЕСТОВАЯ ПЕЧАТЬ MENORA", fakeOrder(), fakeItems(), charset);
                    UsbPrinterBridge.sendRaw(this, device, ticket);
                    runOnUiThread(() -> statusText.setText("Тестовый чек отправлен на печать."));
                } catch (Exception e) {
                    runOnUiThread(() -> statusText.setText("Ошибка печати: " + e.getMessage()));
                }
            }, "menora-test-print").start();
        });
    }

    private void onSaveAndStart() {
        String email = inputEmail.getText().toString().trim();
        String password = inputPassword.getText().toString();
        String rawSlug = inputSlug.getText().toString().trim();
        String slug = rawSlug.replaceAll(".*/([a-zA-Z0-9-]+)/?$", "$1");
        UsbDevice device = selectedDevice();
        String charset = selectedCharset();

        if (email.isEmpty() || password.isEmpty() || slug.isEmpty() || device == null) {
            statusText.setText("Заполните все поля и выберите принтер.");
            return;
        }

        UsbPrinterBridge.requestPermission(this, device, granted -> {
            if (!granted) {
                runOnUiThread(() -> statusText.setText("Нет разрешения на доступ к USB-устройству"));
                return;
            }
            Config.save(this, email, password, slug, deviceKey(device), charset);
            Intent serviceIntent = new Intent(this, PrintService.class);
            if (Build.VERSION.SDK_INT >= 26) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
            runOnUiThread(() -> {
                statusText.setText("Запущено — работает в фоне, ждёт заказы.");
                Toast.makeText(this, "Настройки сохранены", Toast.LENGTH_SHORT).show();
            });
        });
    }

    private static JSONObject fakeOrder() throws Exception {
        JSONObject o = new JSONObject();
        o.put("id", "test-0000-0000-0000-000000000000");
        o.put("order_number", 0);
        o.put("created_at", Instant.now().toString());
        o.put("fulfillment", "dine_in");
        o.put("table_number", "5");
        o.put("customer_name", "Тестовый Клиент");
        o.put("phone", "+998 90 123 45 67");
        o.put("comment", "Проверка кириллицы: Бургер, Чебурек, Чай");
        o.put("discount", 0);
        o.put("total", 87000);
        return o;
    }

    private static JSONArray fakeItems() throws Exception {
        JSONArray arr = new JSONArray();
        JSONObject i1 = new JSONObject();
        i1.put("dish_name", "Чикен бургер");
        i1.put("quantity", 2);
        i1.put("price", 29000);
        arr.put(i1);
        JSONObject i2 = new JSONObject();
        i2.put("dish_name", "Милкшейк клубничный");
        i2.put("quantity", 1);
        i2.put("price", 29000);
        arr.put(i2);
        return arr;
    }
}
