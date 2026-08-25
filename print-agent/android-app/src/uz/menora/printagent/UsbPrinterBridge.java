package uz.menora.printagent;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

// Печать на чековый ESC/POS-принтер, подключённый по USB-OTG кабелю —
// напрямую через Android USB Host API, без обмена через "общий доступ",
// как в Windows-версии (на телефоне такого понятия просто нет). Дешёвые
// принтеры этого класса не требуют root и не нуждаются в специальном
// драйвере — просто bulk-передача сырых ESC/POS-байт на нужный endpoint.
public class UsbPrinterBridge {
    private static final String ACTION_USB_PERMISSION = "uz.menora.printagent.USB_PERMISSION";

    public interface PermissionCallback {
        void onResult(boolean granted);
    }

    public static Map<String, UsbDevice> listDevices(Context ctx) {
        UsbManager manager = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        return new HashMap<>(manager.getDeviceList());
    }

    public static boolean hasPermission(Context ctx, UsbDevice device) {
        UsbManager manager = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        return manager.hasPermission(device);
    }

    public static void requestPermission(Context ctx, UsbDevice device, PermissionCallback callback) {
        UsbManager manager = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        if (manager.hasPermission(device)) {
            callback.onResult(true);
            return;
        }
        int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 0, new Intent(ACTION_USB_PERMISSION), flags);

        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;
                boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
                context.unregisterReceiver(this);
                callback.onResult(granted);
            }
        };
        // targetSdkVersion у приложения — 31 (см. AndroidManifest.xml), поэтому
        // жёсткое требование Android 13+ указывать RECEIVER_EXPORTED/
        // NOT_EXPORTED на это приложение не распространяется — простого
        // двухаргументного вызова достаточно на всех версиях.
        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        ctx.registerReceiver(receiver, filter);
        manager.requestPermission(device, pi);
    }

    // Находит первый интерфейс с bulk OUT endpoint'ом и шлёт байты. Почти
    // все чековые принтеры отдают ровно один такой интерфейс.
    public static void sendRaw(Context ctx, UsbDevice device, byte[] data) throws IOException {
        UsbManager manager = (UsbManager) ctx.getSystemService(Context.USB_SERVICE);
        if (!manager.hasPermission(device)) {
            throw new IOException("Нет разрешения на доступ к USB-принтеру");
        }

        UsbInterface targetInterface = null;
        UsbEndpoint outEndpoint = null;
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            for (int e = 0; e < iface.getEndpointCount(); e++) {
                UsbEndpoint ep = iface.getEndpoint(e);
                if (ep.getType() == UsbConstants.USB_ENDPOINT_XFER_BULK && ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    targetInterface = iface;
                    outEndpoint = ep;
                    break;
                }
            }
            if (outEndpoint != null) break;
        }
        if (targetInterface == null || outEndpoint == null) {
            throw new IOException("У этого USB-устройства не найден выход для печати (bulk OUT endpoint)");
        }

        UsbDeviceConnection connection = manager.openDevice(device);
        if (connection == null) {
            throw new IOException("Не удалось открыть соединение с USB-устройством");
        }
        try {
            if (!connection.claimInterface(targetInterface, true)) {
                throw new IOException("Не удалось занять USB-интерфейс принтера");
            }
            // Крупные чеки шлём кусками — некоторые дешёвые принтеры режут
            // одну гигантскую bulk-передачу вместо того чтобы буферизовать.
            int chunk = 4096;
            int offset = 0;
            while (offset < data.length) {
                int len = Math.min(chunk, data.length - offset);
                byte[] part = new byte[len];
                System.arraycopy(data, offset, part, 0, len);
                int sent = connection.bulkTransfer(outEndpoint, part, len, 5000);
                if (sent < 0) {
                    throw new IOException("Ошибка передачи данных на принтер");
                }
                offset += len;
            }
        } finally {
            connection.close();
        }
    }
}
