package uz.menora.printagent;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

// Кухонный телефон обычно не выключают, но если перезагрузили (обновление,
// разрядка) — печать должна продолжиться сама, без похода в приложение.
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        Config cfg = Config.load(context);
        if (!cfg.isComplete()) return;
        Intent serviceIntent = new Intent(context, PrintService.class);
        if (Build.VERSION.SDK_INT >= 26) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
