package uz.menora.printagent;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.usb.UsbDevice;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// Фоновая служба: раз в несколько секунд спрашивает Supabase "есть новые
// неотпечатанные заказы?" и печатает их. Опрос (polling) вместо Realtime —
// официального лёгкого Supabase Realtime SDK под чистую Java (без Gradle)
// нет, а REST через HttpURLConnection есть из коробки в Android — раз в
// 4 секунды через REST практически неотличимо на глаз от мгновенной печати,
// но кода и зависимостей на порядок меньше.
public class PrintService extends Service {
    private static final String CHANNEL_ID = "menora_print_service";
    private static final int NOTIF_ID = 1;
    private static final long POLL_INTERVAL_MS = 4000;

    private volatile boolean running = false;
    private Thread worker;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, buildNotification("Подключаюсь..."), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, buildNotification("Подключаюсь..."));
        }
        if (!running) {
            running = true;
            worker = new Thread(this::runLoop, "menora-print-loop");
            worker.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void runLoop() {
        Config cfg = Config.load(this);
        if (!cfg.isComplete()) {
            updateNotification("Не настроено — откройте приложение");
            stopSelf();
            return;
        }

        SupabaseClient client = new SupabaseClient(cfg.email, cfg.password);
        String venueId = null;
        String venueName = "Menora";
        // Как и в Windows-агенте: при старте допечатываем то, что осталось
        // неотпечатанным за последние 2 часа, но не глубже — иначе первый
        // запуск на новом телефоне распечатает весь исторический архив.
        String sinceIso = Instant.now().minusSeconds(2 * 3600).toString();

        while (running) {
            try {
                if (!client.isLoggedIn()) {
                    updateNotification("Вход в кабинет...");
                    client.login();
                }
                if (venueId == null) {
                    venueId = client.findVenueId(cfg.venueSlug);
                    if (venueId == null) {
                        updateNotification("Заведение \"" + cfg.venueSlug + "\" не найдено");
                        Thread.sleep(POLL_INTERVAL_MS * 3);
                        continue;
                    }
                }

                updateNotification("Ждёт заказы — " + cfg.venueSlug);
                JSONArray orders = client.getPendingOrders(venueId, sinceIso);
                for (int i = 0; i < orders.length(); i++) {
                    if (!running) break;
                    JSONObject order = orders.getJSONObject(i);
                    try {
                        printOrder(cfg, order, venueName, client);
                        client.markPrinted(order.getString("id"), Instant.now().toString());
                    } catch (Exception printErr) {
                        updateNotification("Ошибка печати заказа: " + printErr.getMessage());
                    }
                }
            } catch (SupabaseClient.AuthException authErr) {
                updateNotification("Ошибка входа: " + authErr.getMessage());
            } catch (Exception e) {
                updateNotification("Ошибка сети: " + e.getMessage());
            }

            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException ignored) {
                break;
            }
        }
    }

    private void printOrder(Config cfg, JSONObject order, String venueName, SupabaseClient client) throws Exception {
        UsbDevice device = findConfiguredDevice(cfg);
        if (device == null) {
            throw new Exception("USB-принтер не найден (проверьте кабель)");
        }
        JSONArray items = fetchItemsWithRetry(client, order.getString("id"));
        if (items.length() == 0) {
            // order_items иногда ещё не успевает вставиться к моменту, когда
            // сам заказ уже виден при опросе — не отмечаем напечатанным,
            // следующий цикл опроса (через 4 сек) попробует снова.
            throw new Exception("заказ ещё без позиций, попробую на следующем опросе");
        }
        byte[] ticket = buildTicket(venueName, order, items, cfg.charset);
        UsbPrinterBridge.sendRaw(this, device, ticket);
    }

    // Тот же приём, что и в Windows-агенте (agent.js): позиции заказа
    // (order_items) иногда появляются в базе на долю секунды позже самого
    // заказа — до 6 попыток по 500мс, прежде чем сдаться.
    private JSONArray fetchItemsWithRetry(SupabaseClient client, String orderId) throws Exception {
        for (int i = 0; i < 6; i++) {
            JSONArray items = client.getOrderItems(orderId);
            if (items.length() > 0) return items;
            Thread.sleep(500);
        }
        return new JSONArray();
    }

    private UsbDevice findConfiguredDevice(Config cfg) {
        return MainActivity.findByKey(this, cfg.usbDeviceKey);
    }

    static byte[] buildTicket(String venueName, JSONObject order, JSONArray items, String charset) throws Exception {
        int width = 32; // безопасная ширина по умолчанию — подходит и для 58мм, и для 80мм
        EscPos p = new EscPos(charset);
        p.alignCenter().big(true).bold(true).line(venueName).bold(false).big(false);
        p.line(formatDate(order.optString("created_at")));
        p.separator(width);

        String fulfillment = order.optString("fulfillment", "delivery");
        p.alignCenter().bold(true);
        if ("dine_in".equals(fulfillment)) {
            p.line("СТОЛ #" + order.optString("table_number", "?"));
        } else if ("delivery".equals(fulfillment)) {
            p.line("ДОСТАВКА");
        } else {
            p.line("САМОВЫВОЗ");
        }
        p.bold(false);
        p.separator(width);

        p.alignLeft();
        p.line("Заказ #" + order.optLong("order_number", 0));
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            int qty = item.optInt("quantity", 1);
            double price = item.optDouble("price", 0);
            String name = item.optString("dish_name", "");
            p.leftRight(qty + "x " + name, formatMoney(price * qty), width);
        }
        p.separator(width);

        if (!order.isNull("promo_code") && order.optString("promo_code", "").length() > 0) {
            p.leftRight("Промокод " + order.optString("promo_code"), "", width);
        }
        double discount = order.optDouble("discount", 0);
        if (discount > 0) {
            p.leftRight("Скидка", "-" + formatMoney(discount), width);
        }
        p.big(true).bold(true);
        p.leftRight("ИТОГО", formatMoney(order.optDouble("total", 0)), width);
        p.bold(false).big(false);
        p.separator(width);

        p.line("Клиент: " + order.optString("customer_name", ""));
        p.line("Тел: " + order.optString("phone", ""));
        if ("delivery".equals(fulfillment) && !order.isNull("address")) {
            String address = order.optString("address", "");
            if (address.length() > 0) p.line("Адрес: " + address);
        }
        if (!order.isNull("comment")) {
            String comment = order.optString("comment", "");
            if (comment.length() > 0) p.line("Комментарий: " + comment);
        }

        p.cut();
        return p.toBytes();
    }

    private static String formatMoney(double value) {
        // ru-RU группирует разряды неразрывным пробелом (U+00A0), которого
        // нет в однобайтовых кодировках принтера — печатался "?". Обычный
        // пробел (0x20) есть в любой кодировке.
        NumberFormat nf = NumberFormat.getInstance(new Locale("ru", "RU"));
        if (nf instanceof java.text.DecimalFormat) {
            java.text.DecimalFormat df = (java.text.DecimalFormat) nf;
            java.text.DecimalFormatSymbols symbols = df.getDecimalFormatSymbols();
            symbols.setGroupingSeparator(' ');
            df.setDecimalFormatSymbols(symbols);
        }
        return nf.format(Math.round(value)) + " сум";
    }

    private static String formatDate(String iso) {
        try {
            OffsetDateTime dt = OffsetDateTime.parse(iso);
            return dt.atZoneSameInstant(ZoneId.of("Asia/Tashkent"))
                    .format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm"));
        } catch (Exception e) {
            return iso;
        }
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Menora — печать чеков", NotificationManager.IMPORTANCE_LOW);
            NotificationManager nm = getSystemService(NotificationManager.class);
            nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String text) {
        Intent openIntent = new Intent(this, MainActivity.class);
        int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent, flags);
        return new Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("Menora — печать чеков")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_send)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.notify(NOTIF_ID, buildNotification(text));
    }
}
