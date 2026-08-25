// Интерактивная настройка при первом запуске — заменяет ручное редактирование
// .env текстовым редактором на несколько вопросов прямо в окне программы.
const readline = require("readline");
const { execFile } = require("child_process");

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

// readline не умеет маскировать ввод "из коробки" — гасим эхо терминала на
// время ввода пароля тем же способом, что используют большинство Node-CLI.
function askHidden(rl, question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = "";
    const onData = (char) => {
      char = char.toString();
      if (char === "\n" || char === "\r" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u0003") process.exit(1); // Ctrl+C
      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

function runPowerShellJson(script) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr?.toString() || error.message));
        resolve(stdout.toString().trim());
      },
    );
  });
}

async function listPrinters() {
  const out = await runPowerShellJson(
    "Get-Printer | Select-Object Name,Shared,ShareName | ConvertTo-Json -Compress",
  );
  if (!out) return [];
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function deriveShareName(printerName) {
  const cleaned = printerName.replace(/[^A-Za-z0-9]/g, "").slice(0, 30);
  return cleaned || "MenoraPrinter";
}

// Возвращает { printerName, shared, error } — printerName это то самое сетевое
// имя, которое нужно указать в конфиге (RawPrinterInterface бьёт по нему
// через \\localhost\<printerName>).
async function ensureShared(printer) {
  if (printer.Shared && printer.ShareName) {
    return { printerName: printer.ShareName, shared: true };
  }
  const shareName = deriveShareName(printer.Name);
  try {
    await runPowerShellJson(
      `Set-Printer -Name "${printer.Name.replace(/"/g, '""')}" -Shared $true -ShareName "${shareName}"`,
    );
    return { printerName: shareName, shared: true };
  } catch (err) {
    return { printerName: shareName, shared: false, error: err.message };
  }
}

async function pickPrinter(rl) {
  process.stdout.write("\nИщу принтеры, подключённые к этому компьютеру...\n");
  let printers;
  try {
    printers = await listPrinters();
  } catch {
    printers = [];
  }

  if (printers.length === 0) {
    process.stdout.write(
      "Принтеры не найдены. Убедитесь, что принтер включён и установлен в Windows, затем введите его имя вручную.\n",
    );
    const manual = await ask(rl, "Имя принтера: ");
    return manual;
  }

  printers.forEach((p, i) => {
    process.stdout.write(`  ${i + 1}) ${p.Name}${p.Shared ? ` (расшарен как "${p.ShareName}")` : ""}\n`);
  });
  process.stdout.write(`  ${printers.length + 1}) Ввести имя вручную\n`);

  let choice;
  while (true) {
    const raw = await ask(rl, `Выберите принтер [1-${printers.length + 1}]: `);
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= printers.length + 1) {
      choice = n;
      break;
    }
    process.stdout.write("Введите номер из списка.\n");
  }

  if (choice === printers.length + 1) {
    return ask(rl, "Имя принтера: ");
  }

  const selected = printers[choice - 1];
  process.stdout.write(`Настраиваю общий доступ к "${selected.Name}"...\n`);
  const result = await ensureShared(selected);
  if (result.shared) {
    process.stdout.write(`✅ Готово — принтер расшарен как "${result.printerName}"\n`);
  } else {
    process.stdout.write(
      `⚠️ Не удалось расшарить принтер автоматически (${result.error}). Сделайте это вручную: ` +
        `Панель управления → Устройства и принтеры → свойства принтера → вкладка "Доступ" → ` +
        `"Общий доступ к данному принтеру" → имя "${result.printerName}". Запустите программу от имени администратора, чтобы это сработало автоматически.\n`,
    );
  }
  return result.printerName;
}

async function runFullSetupWizard() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write("Menora — печать чеков\n======================\n\nПервый запуск — давайте настроим:\n\n");

  let email = "";
  while (!email) email = await ask(rl, "Email от кабинета Menora: ");

  let password = "";
  while (!password) password = await askHidden(rl, "Пароль: ");

  let slug = "";
  while (!slug) {
    const input = await ask(rl, "Ссылка на ваше меню (или просто slug из неё): ");
    // Гость может вставить всю ссылку menora.uz/slug — вырезаем сам slug.
    const match = input.match(/([a-z0-9-]+)\/?$/i);
    slug = match ? match[1] : input;
  }

  const printerName = await pickPrinter(rl);
  rl.close();

  return { CABINET_EMAIL: email, CABINET_PASSWORD: password, VENUE_SLUG: slug, PRINTER_NAME: printerName };
}

async function runPrinterOnlyWizard() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  process.stdout.write("Menora — тестовая печать\n=========================\n");
  const printerName = await pickPrinter(rl);
  rl.close();
  return { PRINTER_NAME: printerName };
}

module.exports = { runFullSetupWizard, runPrinterOnlyWizard };
