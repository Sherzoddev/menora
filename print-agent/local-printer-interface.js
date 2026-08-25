// Отправляет "сырые" ESC/POS-байты на локальный принтер без единой нативной
// npm-зависимости (никакого node-gyp/Visual Studio Build Tools на кухонном
// ПК ставить не нужно — только Node.js).
//
// Windows: принтер должен быть расшарен (см. README) — тогда простой
// `copy /b` кладёт байты в очередь печати без какой-либо обработки.
// Это старый, но очень надёжный трюк, десятилетиями используемый для
// печати ESC/POS на чековых принтерах.
//
// macOS/Linux: используется системная команда `lp -o raw`, которая есть
// в CUPS из коробки.
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    // timeout — если принтер завис/не отвечает, "copy" может висеть
    // бесконечно и вместе с ним всё окно настройки (оно ждёт этот процесс
    // синхронно). Через 15 сек лучше явная ошибка, чем зависшая программа.
    execFile(cmd, args, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr?.toString() || error.message));
      else resolve(stdout);
    });
  });
}

class RawPrinterInterface {
  constructor(printerName) {
    this.printerName = printerName;
  }

  // Полноценной проверки без нативных биндингов нет — просто отдаём true,
  // ошибка печати всё равно всплывёт в execute() и попадёт в лог агента.
  async isPrinterConnected() {
    return true;
  }

  async execute(buffer) {
    const tmpFile = path.join(os.tmpdir(), `menora-ticket-${Date.now()}-${Math.random().toString(36).slice(2)}.prn`);
    fs.writeFileSync(tmpFile, buffer);
    try {
      if (process.platform === "win32") {
        await run("cmd.exe", ["/d", "/c", "copy", "/b", tmpFile, `\\\\localhost\\${this.printerName}`]);
      } else {
        await run("lp", ["-d", this.printerName, "-o", "raw", tmpFile]);
      }
      return "printed";
    } catch {
      // Windows' `copy` reports errors in the console codepage, which comes
      // out as mojibake through Node — a clear hint is more useful anyway.
      throw new Error(
        process.platform === "win32"
          ? `Не удалось напечатать через "\\\\localhost\\${this.printerName}". Проверьте: 1) принтер расшарен под именем "${this.printerName}" (см. README), 2) принтер включён и не показывает ошибку в Windows.`
          : `Не удалось напечатать на "${this.printerName}" через lp. Проверьте имя принтера командой "lpstat -p".`,
      );
    } finally {
      fs.unlink(tmpFile, () => {});
    }
  }
}

module.exports = { RawPrinterInterface };
