package uz.menora.printagent;

import java.io.ByteArrayOutputStream;
import java.io.UnsupportedEncodingException;

// Собирает сырые ESC/POS-байты для чека — тот же принцип, что в Windows-агенте
// (print-agent/agent.js через node-thermal-printer), только здесь без
// сторонней библиотеки, чтобы не тащить лишние зависимости в сборку без
// Gradle. Дешёвые китайские чековые принтеры (XP-58/XP-80 и клоны) обычно
// понимают именно эти команды.
public class EscPos {
    public static final String CHARSET_CP866 = "CP866";
    public static final String CHARSET_WIN1251 = "WIN1251";

    private final ByteArrayOutputStream buf = new ByteArrayOutputStream();
    private final String charset;

    public EscPos(String charset) {
        this.charset = charset;
        buf.write(0x1B); buf.write(0x40); // ESC @ — сброс принтера
        // FS . (1C 2E) — отменить "китайский" двухбайтовый режим (Kanji
        // mode). У многих дешёвых китайских клонов он включён по
        // умолчанию, и тогда любые байты 0x80+ печатаются как китайские
        // иероглифы независимо от того, что выбрано через ESC t ниже —
        // сначала обязательно нужно выключить именно этот режим.
        buf.write(0x1C); buf.write(0x2E);
        // ESC t n — выбор кодовой страницы. 17 (0x11) = PC866 (Cyrillic #2),
        // 6 (0x06) = WIN1251 — так у большинства бюджетных ESC/POS-принтеров
        // этой категории (XP-58/XP-80 и клоны). Если кириллица всё равно
        // кракозябры — переключите кодировку в настройках приложения на
        // другую (это ровно то же самое, что PRINTER_CHARACTER_SET в
        // Windows-версии).
        buf.write(0x1B); buf.write(0x74);
        buf.write(charset.equals(CHARSET_WIN1251) ? 0x06 : 0x11);
    }

    public EscPos bold(boolean on) {
        buf.write(0x1B); buf.write(0x45); buf.write(on ? 1 : 0);
        return this;
    }

    public EscPos alignCenter() { buf.write(0x1B); buf.write(0x61); buf.write(1); return this; }
    public EscPos alignLeft() { buf.write(0x1B); buf.write(0x61); buf.write(0); return this; }

    public EscPos big(boolean on) {
        buf.write(0x1D); buf.write(0x21); buf.write(on ? 0x11 : 0x00);
        return this;
    }

    public EscPos text(String s) {
        byte[] encoded = encode(s == null ? "" : s, charset);
        buf.write(encoded, 0, encoded.length);
        return this;
    }

    public EscPos line(String s) {
        text(s);
        newLine();
        return this;
    }

    public EscPos newLine() { buf.write(0x0A); return this; }

    public EscPos separator(int width) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < width; i++) sb.append('-');
        return line(sb.toString());
    }

    // Строка "текст слева ... сумма справа" в пределах ширины бумаги.
    public EscPos leftRight(String left, String right, int width) {
        int space = width - left.length() - right.length();
        StringBuilder sb = new StringBuilder(left);
        for (int i = 0; i < Math.max(space, 1); i++) sb.append(' ');
        sb.append(right);
        return line(sb.toString());
    }

    public EscPos cut() {
        newLine(); newLine();
        buf.write(0x1D); buf.write(0x56); buf.write(0x00);
        return this;
    }

    public byte[] toBytes() {
        return buf.toByteArray();
    }

    private static byte[] encode(String s, String charset) {
        if (CHARSET_WIN1251.equals(charset)) {
            try {
                return s.getBytes("windows-1251");
            } catch (UnsupportedEncodingException e) {
                // На случай если конкретная сборка Android этой JVM всё же
                // не тащит windows-1251 — падать в CP866 лучше, чем в крах.
            }
        }
        byte[] out = new byte[s.length()];
        for (int i = 0; i < s.length(); i++) {
            out[i] = cp866(s.charAt(i));
        }
        return out;
    }

    // CP866 ("Альтернативная" кодировка ГОСТ) — та же, что PC866_CYRILLIC2
    // по умолчанию в Windows-агенте. Раскладка кириллицы в этой кодовой
    // странице арифметическая (см. любую таблицу CP866), без нужды в
    // большом статическом массиве соответствий.
    private static byte cp866(char c) {
        if (c == 0x0401) return (byte) 0xF0; // Ё
        if (c == 0x0451) return (byte) 0xF1; // ё
        if (c >= 0x0410 && c <= 0x041F) return (byte) (0x80 + (c - 0x0410)); // А-П
        if (c >= 0x0420 && c <= 0x042F) return (byte) (0x90 + (c - 0x0420)); // Р-Я
        if (c >= 0x0430 && c <= 0x043F) return (byte) (0xA0 + (c - 0x0430)); // а-п
        if (c >= 0x0440 && c <= 0x044F) return (byte) (0xE0 + (c - 0x0440)); // р-я
        if (c < 128) return (byte) c;
        return (byte) '?';
    }
}
