// Menora — локальный принт-агент кухонного чека.
//
// Что делает: держит соединение с Supabase Realtime, и как только в
// заведении появляется новый заказ — сразу печатает чек на чековом
// ESC/POS-принтере, подключённом по USB к этому компьютеру.
//
// Почему это отдельная программа, а не часть сайта: сайт крутится в облаке
// и физически не имеет доступа к USB-порту компьютера на кухне. Единственный
// надёжный способ — программа, которая работает прямо на этом компьютере.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { printer: ThermalPrinter, types: PrinterTypes, CharacterSet } = require("node-thermal-printer");
const { Transport, MultiTransportInterface, listWindowsPrinters, listUsbDevices, listSerialPorts } = require("./printer-transport");
const { runFullSetupWizard, runPrinterOnlyWizard } = require("./setup-wizard");

// Menora — единый облачный сервис на одном Supabase-проекте для всех
// заведений, поэтому URL и публичный (anon) ключ одни и те же для каждого
// клиента — их не нужно спрашивать у владельца заведения.
// "sb_publishable_..." — это специально публичный ключ (не секрет), Supabase
// сам называет такие ключи safe-to-embed в клиентских приложениях.
const DEFAULT_SUPABASE_URL = "https://kgfmjzeegkkeizuhsycz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_tG8FIJiiZHuqy48PPGfT_w_oQKCqjo4";

const isTestPrint = process.argv.includes("--test");
const forceSetup = process.argv.includes("--setup");

// Упакованный через Node SEA .exe встраивает весь код внутрь себя как
// read-only блоб — __dirname внутри него не указывает на реальную папку на
// диске, поэтому конфиг всегда кладём рядом с самим exe-файлом
// (process.execPath). В обычном "node agent.js" (разработка) это не SEA, и
// __dirname — это просто папка агента, как и раньше.
function getBaseDir() {
  let isSea = false;
  try {
    isSea = require("node:sea").isSea();
  } catch {
    // node:sea недоступен на старых версиях Node — тогда это точно не SEA.
  }
  return isSea ? path.dirname(process.execPath) : __dirname;
}

const BASE_DIR = getBaseDir();
const CONFIG_PATH = path.join(BASE_DIR, "config.json");

function loadConfigFile() {
  try {
    // Настройка сохраняется через PowerShell (gui/setup-gui.ps1) — на
    // случай, если там (сейчас или в будущем) допишется BOM, JSON.parse
    // сам его не пропускает и тихо падает на первом символе. Срезаем явно,
    // чтобы конфиг не считался "пустым" из-за одного лишнего байта.
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch {
    return null;
  }
}

function saveConfigFile(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function log(...args) {
  console.log(`[${new Date().toLocaleTimeString("ru-RU")}]`, ...args);
}

// Собирает итоговый конфиг из (по приоритету) переменных окружения (для
// разработки — .env) поверх сохранённого config.json, и при нехватке
// обязательных полей запускает интерактивный мастер настройки прямо в
// этом же окне — вместо требования вручную редактировать текстовый файл.
async function resolveConfig() {
  const fileConfig = loadConfigFile() || {};
  const merged = { ...fileConfig };
  for (const key of [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "CABINET_EMAIL",
    "CABINET_PASSWORD",
    "VENUE_ID",
    "VENUE_SLUG",
    "PRINTER_TRANSPORT",
    "PRINTER_NAME",
    "PRINTER_USB_VENDOR",
    "PRINTER_USB_PRODUCT",
    "PRINTER_SERIAL_PATH",
    "PRINTER_WIDTH",
    "PRINTER_CHARACTER_SET",
  ]) {
    if (process.env[key]) merged[key] = process.env[key];
  }

  const hasPrinterTarget =
    (merged.PRINTER_TRANSPORT === Transport.USB && merged.PRINTER_USB_VENDOR && merged.PRINTER_USB_PRODUCT) ||
    (merged.PRINTER_TRANSPORT === Transport.BLUETOOTH && merged.PRINTER_SERIAL_PATH) ||
    ((!merged.PRINTER_TRANSPORT || merged.PRINTER_TRANSPORT === Transport.WINDOWS) && merged.PRINTER_NAME);

  if (isTestPrint) {
    if (!hasPrinterTarget || forceSetup) {
      const answers = await runPrinterOnlyWizard();
      Object.assign(merged, answers);
      saveConfigFile(merged);
    }
  } else {
    const missingRequired = !merged.CABINET_EMAIL || !merged.CABINET_PASSWORD || !hasPrinterTarget || (!merged.VENUE_ID && !merged.VENUE_SLUG);
    if (forceSetup) {
      // --setup только для разработки (см. README) — обычный владелец
      // заведения его никогда не наберёт, поэтому текстовый мастер здесь
      // безопасен и не путает с настоящим приложением (Menora.vbs).
      const answers = await runFullSetupWizard();
      Object.assign(merged, answers);
      saveConfigFile(merged);
    } else if (missingRequired) {
      // Раньше здесь запускался текстовый мастер прямо в этом окне — из-за
      // этого владельцы путали menora-print.exe (голый "мотор") с
      // Menora.vbs (настоящее приложение с окном) и попадали в чёрный
      // терминал. Теперь прямой запуск .exe без настройки просто и ясно
      // объясняет, что нужно сделать, вместо того чтобы притворяться
      // полноценным интерфейсом.
      console.error("Menora не настроена.");
      console.error("Не запускайте menora-print.exe напрямую — дважды кликните по Menora.vbs (лежит рядом), он откроет окно настройки.");
      await new Promise((resolve) => {
        process.stdout.write("\nНажмите Enter, чтобы закрыть это окно...");
        process.stdin.once("data", resolve);
      });
      process.exit(1);
    }
  }

  merged.SUPABASE_URL = merged.SUPABASE_URL || DEFAULT_SUPABASE_URL;
  merged.SUPABASE_ANON_KEY = merged.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
  return merged;
}

let CFG = {};

function formatMoney(value) {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} сум`;
}

function makePrinter() {
  const width = Number(CFG.PRINTER_WIDTH) || 42;
  // Дешёвые китайские "HP80"/"POS-80" принтеры не стандартизированы по
  // кодировке кириллицы — у большинства это PC866, но встречаются и WPC1251.
  // Если чек печатает кракозябры вместо кириллицы, поменяйте это в окне
  // настройки (или PRINTER_CHARACTER_SET в config.json) на другой вариант.
  const characterSet = CharacterSet[CFG.PRINTER_CHARACTER_SET] || CharacterSet.PC866_CYRILLIC2;
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: new MultiTransportInterface(CFG, BASE_DIR),
    width,
    characterSet,
    removeSpecialCharacters: false,
  });
}

async function buildTicket(printer, { order, items, venueName }) {
  printer.clear();
  printer.alignCenter();
  printer.setTextDoubleHeight();
  printer.bold(true);
  printer.println(venueName);
  printer.bold(false);
  printer.setTextNormal();
  printer.println(new Date(order.created_at).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" }));
  printer.drawLine();

  if (order.fulfillment === "dine_in") {
    printer.setTextQuadArea();
    printer.bold(true);
    printer.println(`СТОЛ #${order.table_number}`);
    printer.bold(false);
    printer.setTextNormal();
  } else {
    printer.bold(true);
    printer.println(order.fulfillment === "delivery" ? "ДОСТАВКА" : "САМОВЫВОЗ");
    printer.bold(false);
  }
  printer.drawLine();

  printer.alignLeft();
  printer.println(`Заказ #${order.order_number}`);
  for (const item of items) {
    printer.leftRight(`${item.quantity}x ${item.dish_name}`, formatMoney(item.price * item.quantity));
  }
  printer.drawLine();

  if (order.promo_code) {
    printer.leftRight(`Промокод ${order.promo_code}`, "");
  }
  if (order.discount > 0) {
    printer.leftRight("Скидка", `-${formatMoney(order.discount)}`);
  }
  printer.setTextDoubleHeight();
  printer.bold(true);
  printer.leftRight("ИТОГО", formatMoney(order.total));
  printer.bold(false);
  printer.setTextNormal();
  printer.drawLine();

  printer.println(`Клиент: ${order.customer_name}`);
  printer.println(`Тел: ${order.phone}`);
  if (order.fulfillment === "delivery" && order.address) {
    printer.println(`Адрес: ${order.address}`);
  }
  if (order.comment) {
    printer.println(`Комментарий: ${order.comment}`);
  }

  printer.newLine();
  printer.newLine();
  printer.cut();
}

async function printOrder(order, items, venueName) {
  const printer = makePrinter();
  await buildTicket(printer, { order, items, venueName });
  await printer.execute();
  log(`Чек напечатан: заказ №${order.order_number}${order.table_number ? `, стол ${order.table_number}` : ""}`);
}

async function testPrint() {
  const printer = makePrinter();
  await buildTicket(printer, {
    order: {
      id: "test-0000-0000",
      order_number: 0,
      created_at: new Date().toISOString(),
      fulfillment: "dine_in",
      table_number: "5",
      customer_name: "Тестовый Клиент",
      phone: "+998 90 123 45 67",
      address: null,
      comment: "Проверка кириллицы: Бургер, Чебурек, Чай",
      promo_code: null,
      discount: 0,
      total: 87000,
    },
    items: [
      { dish_name: "Чикен бургер", quantity: 2, price: 29000 },
      { dish_name: "Милкшейк клубничный", quantity: 1, price: 29000 },
    ],
    venueName: "ТЕСТОВАЯ ПЕЧАТЬ MENORA",
  });
  await printer.execute();
  log("Тестовый чек отправлен на печать. Если кириллица нечитаема — запустите с флагом --setup и выберите принтер заново, указав PRINTER_CHARACTER_SET в config.json.");
}

async function fetchItemsWithRetry(supabase, orderId, attempts = 6, delayMs = 500) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.from("order_items").select("*").eq("order_id", orderId);
    if (data && data.length > 0) return data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return [];
}

async function markPrinted(supabase, orderId) {
  await supabase.from("orders").update({ printed_at: new Date().toISOString() }).eq("id", orderId);
}

async function handleNewOrder(supabase, venueName, order) {
  try {
    const items = await fetchItemsWithRetry(supabase, order.id);
    if (items.length === 0) {
      log(`Заказ №${order.order_number} без позиций (не дождались order_items) — пропускаю`);
      return;
    }
    await printOrder(order, items, venueName);
    await markPrinted(supabase, order.id);
  } catch (err) {
    console.error(`[menora-print-agent] Не удалось напечатать заказ ${order.id}:`, err.message);
  }
}

// Список устройств для окна настройки — вызывается как
// "velora-print.exe --list-devices windows|usb|bluetooth", печатает JSON в
// stdout и сразу выходит. Отдельно от resolveConfig(): выбор устройства
// нужен ДО того, как конфиг вообще существует.
async function listDevicesMode() {
  const kind = process.argv[process.argv.indexOf("--list-devices") + 1];
  let result;
  if (kind === Transport.USB) result = await listUsbDevices(BASE_DIR);
  else if (kind === Transport.BLUETOOTH) result = await listSerialPorts(BASE_DIR);
  else result = await listWindowsPrinters();
  process.stdout.write(JSON.stringify(result));
}

async function main() {
  if (process.argv.includes("--list-devices")) {
    await listDevicesMode();
    return;
  }

  CFG = await resolveConfig();

  if (isTestPrint) {
    await testPrint();
    return;
  }

  const supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: true },
  });

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: CFG.CABINET_EMAIL,
    password: CFG.CABINET_PASSWORD,
  });
  if (authError) {
    console.error("[menora-print-agent] Не удалось войти в кабинет:", authError.message);
    console.error("Проверьте email/пароль — перезапустите программу с флагом --setup, чтобы ввести их заново.");
    process.exit(1);
  }
  log("Вход в кабинет выполнен успешно");

  let venueId = CFG.VENUE_ID;
  let venueName = "Menora";
  if (CFG.VENUE_SLUG) {
    const { data: venue, error } = await supabase.from("venues").select("id, name").eq("slug", CFG.VENUE_SLUG).maybeSingle();
    if (error || !venue) {
      console.error(`[menora-print-agent] Не удалось найти заведение по slug "${CFG.VENUE_SLUG}" — перезапустите с --setup и проверьте ссылку на меню.`);
      process.exit(1);
    }
    venueId = venue.id;
    venueName = venue.name;
  } else {
    const { data: venue } = await supabase.from("venues").select("name").eq("id", venueId).maybeSingle();
    if (venue?.name) venueName = venue.name;
  }

  // Догоняем заказы, пришедшие пока агент был выключен (например, кухонный
  // ПК был выключен на ночь) — печатаем только то, что ещё не печаталось.
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await supabase
    .from("orders")
    .select("*")
    .eq("venue_id", venueId)
    .is("printed_at", null)
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: true });

  for (const order of pending ?? []) {
    await handleNewOrder(supabase, venueName, order);
  }

  log(`Заведение: ${venueName}`);

  supabase
    .channel(`orders-print-${venueId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders", filter: `venue_id=eq.${venueId}` },
      (payload) => handleNewOrder(supabase, venueName, payload.new),
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") log("Готово — жду новые заказы...");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("[menora-print-agent] Проблема с подключением к Supabase Realtime:", status);
      }
    });
}

main().catch((err) => {
  console.error("[menora-print-agent] Критическая ошибка:", err);
  process.exit(1);
});
