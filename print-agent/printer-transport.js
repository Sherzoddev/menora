// Три способа достучаться до кухонного принтера — тот же набор и по тем же
// причинам, что и в самой Velora (web/src/lib/printerTransport.ts) и в
// Android-агенте Menora (UsbPrinterBridge.java):
//
// - windows — RAW-печать через официальный API диспетчера печати Windows
//   (winspool.drv: OpenPrinter/StartDocPrinter(pDataType="RAW")/WritePrinter).
//   Не требует расшаривания принтера — работает с уже установленным в
//   Windows принтером напрямую. Тот же приём, что в desktop-приложении
//   Velora (см. desktop/src/main.ts — setupPrinting/RAW_PRINT_PS1).
// - usb — сырые байты прямо в USB-эндпоинт принтера, в обход Windows и
//   любых драйверов вообще. Пакет "usb" (v3+) реализует стандартный
//   интерфейс WebUSB поверх libusb — тот же API, что navigator.usb в
//   браузере (Velora) и то же самое, что делает Android через
//   UsbDeviceConnection.bulkTransfer.
// - bluetooth — печать через виртуальный COM-порт, который Windows создаёт
//   при Bluetooth-сопряжении с принтером (классический Bluetooth SPP).
//   Пакет "serialport" пишет в этот порт как в обычный последовательный.
const path = require("path");
const os = require("os");
const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

// "usb" и "serialport" — нативные модули (компилированный .node-биндинг),
// SEA не умеет встраивать такое внутрь себя, поэтому build-exe.js кладёт их
// как обычную папку node_modules рядом с exe, а не в сам блоб. В SEA обычный
// require("usb") не находит их (у блоба нет реального пути на диске) —
// здесь резолвим явно, относительно папки, где реально лежит exe/agent.js.
function isSeaBinary() {
  try {
    return require("node:sea").isSea();
  } catch {
    // node:sea недоступен на старых версиях Node — тогда это точно не SEA.
    return false;
  }
}

// require() со статичной строкой на каждую ветку — обязательно: esbuild
// помечает "usb"/"serialport" как external (см. build-exe.js) именно по
// буквальному тексту require("usb")/require("serialport") в исходнике.
//
// Внутри SEA обычный require(абсолютныйПуть) не работает вообще — embedder
// понимает только вкомпилированный код и голые имена встроенных модулей
// Node, а не путь на диске (падает с ERR_UNKNOWN_BUILTIN_MODULE). Настоящий
// способ подгрузить внешний пакет по пути — module.createRequire(): та же
// разрешающая логика CommonJS (ищет node_modules), что и у обычного
// require, только отвязанная от местоположения самого блоба.
function loadNative(name, baseDir) {
  const sea = isSeaBinary();
  if (!sea) return require(name);
  const externalRequire = require("node:module").createRequire(path.join(baseDir, "noop.js"));
  return externalRequire(name);
}

const Transport = {
  WINDOWS: "windows",
  USB: "usb",
  BLUETOOTH: "bluetooth",
};

// ---------- windows: RAW-печать через winspool.drv ----------
// Дословно тот же PowerShell-скрипт, что использует desktop-касса Velora
// (main.ts, константа RAW_PRINT_PS1) — тот же официальный Win32 API, никакой
// самодеятельности через "общий доступ к принтеру".
const RAW_PRINT_PS1 = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true, ExactSpelling=true, CallingConvention=CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, IntPtr pBytes, Int32 dwCount) {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Menora Ticket";
        di.pDataType = "RAW";
        bool bSuccess = false;
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    Int32 dwWritten;
                    bSuccess = WritePrinter(hPrinter, pBytes, dwCount, out dwWritten);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        } else {
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        }
        return bSuccess;
    }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
try {
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $ptr, $bytes.Length)
    if (-not $ok) { throw "WritePrinter не удалось выполнить" }
} finally {
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
}
Write-Output "OK"
`;

let rawScriptPath = null;
function getRawPrintScript(baseDir) {
  if (rawScriptPath) return rawScriptPath;
  const file = path.join(baseDir, "raw-print.ps1");
  fs.writeFileSync(file, RAW_PRINT_PS1, "utf8");
  rawScriptPath = file;
  return file;
}

// Принтер, который выключен/не в сети, иногда заставляет WritePrinter
// (внутри raw-print.ps1) зависать на неопределённое время — спулер Windows
// ждёт устройство сам, без своего таймаута. Без ограничения здесь запрос
// висел бы вечно вместо понятной ошибки "принтер не отвечает".
const WINDOWS_PRINT_TIMEOUT_MS = 10000;

async function listWindowsPrinters() {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"],
    { timeout: WINDOWS_PRINT_TIMEOUT_MS },
  );
  return stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function printWindows(baseDir, printerName, bytes) {
  const script = getRawPrintScript(baseDir);
  const tmpFile = path.join(os.tmpdir(), `menora-print-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  fs.writeFileSync(tmpFile, bytes);
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-PrinterName", printerName, "-FilePath", tmpFile],
      { timeout: WINDOWS_PRINT_TIMEOUT_MS },
    );
  } finally {
    fs.unlink(tmpFile, () => {});
  }
}

// ---------- usb: сырые байты в USB-эндпоинт (WebUSB-совместимый API) ----------

function usbDeviceLabel(d) {
  const name = (d.productName || d.manufacturerName || "USB-устройство").trim();
  return `${name} (${d.vendorId.toString(16)}:${d.productId.toString(16)})`;
}

async function listUsbDevices(baseDir) {
  const { usb } = loadNative("usb", baseDir);
  const devices = await usb.getDevices();
  return devices.map((d) => ({
    id: `${d.vendorId}:${d.productId}`,
    vendorId: d.vendorId,
    productId: d.productId,
    label: usbDeviceLabel(d),
  }));
}

// Тот же порядок действий, что writeUsb в web/src/lib/printerTransport.ts:
// найти bulk-OUT эндпоинт интерфейса принтера, захватить интерфейс, короткая
// пауза (дешёвые чипы иначе роняют самую первую передачу), слать кусками.
async function findBulkOutEndpoint(device) {
  if (!device.configuration) await device.selectConfiguration(1);
  const config = device.configuration;
  const printerIface = config.interfaces.find((i) => i.alternates.some((a) => a.interfaceClass === 7));
  const iface =
    printerIface ??
    config.interfaces.find((i) => i.alternates.some((a) => a.endpoints.some((e) => e.direction === "out" && e.type === "bulk")));
  if (!iface) throw new Error("У USB-устройства не нашлось интерфейса принтера");
  const alt = iface.alternates.find((a) => a.endpoints.some((e) => e.direction === "out" && e.type === "bulk"));
  const endpoint = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
  if (!endpoint) throw new Error("У USB-устройства не нашлось bulk-OUT конечной точки");
  return { configurationValue: config.configurationValue, interfaceNumber: iface.interfaceNumber, endpointNumber: endpoint.endpointNumber };
}

async function printUsb(vendorId, productId, bytes, baseDir) {
  const { usb } = loadNative("usb", baseDir);
  const devices = await usb.getDevices();
  const device = devices.find((d) => d.vendorId === vendorId && d.productId === productId);
  if (!device) throw new Error("USB-принтер не найден — проверьте подключение");

  await device.open();
  try {
    const { configurationValue, interfaceNumber, endpointNumber } = await findBulkOutEndpoint(device);
    if (device.configuration?.configurationValue !== configurationValue) {
      await device.selectConfiguration(configurationValue);
    }
    await device.claimInterface(interfaceNumber);
    await new Promise((r) => setTimeout(r, 150));

    const CHUNK = 8 * 1024;
    let offset = 0;
    while (offset < bytes.length) {
      const part = bytes.subarray(offset, offset + CHUNK);
      await device.transferOut(endpointNumber, part);
      offset += part.length;
    }
    await device.releaseInterface(interfaceNumber);
  } finally {
    await device.close().catch(() => {});
  }
}

// ---------- bluetooth: виртуальный COM-порт (сопряжение делает сама Windows) ----------

async function listSerialPorts(baseDir) {
  const { SerialPort } = loadNative("serialport", baseDir);
  const ports = await SerialPort.list();
  return ports.map((p) => ({
    path: p.path,
    label: p.friendlyName ? `${p.path} — ${p.friendlyName}` : p.path,
  }));
}

async function printSerial(portPath, bytes, baseDir) {
  const { SerialPort } = loadNative("serialport", baseDir);
  const port = new SerialPort({ path: portPath, baudRate: 9600, autoOpen: false });
  await new Promise((resolve, reject) => port.open((err) => (err ? reject(err) : resolve())));
  try {
    await new Promise((resolve, reject) => port.write(bytes, (err) => (err ? reject(err) : resolve())));
    await new Promise((resolve, reject) => port.drain((err) => (err ? reject(err) : resolve())));
  } finally {
    await new Promise((resolve) => port.close(() => resolve()));
  }
}

// ---------- Единая точка входа ----------

/** node-thermal-printer ждёт объект-интерфейс с execute(buffer) — этот
 * адаптер маршрутизирует байты в выбранный владельцем транспорт. */
class MultiTransportInterface {
  constructor(cfg, baseDir) {
    this.cfg = cfg;
    this.baseDir = baseDir;
  }

  async isPrinterConnected() {
    return true;
  }

  async execute(buffer) {
    const { cfg } = this;
    const send = async () => {
      if (cfg.PRINTER_TRANSPORT === Transport.USB) {
        await printUsb(Number(cfg.PRINTER_USB_VENDOR), Number(cfg.PRINTER_USB_PRODUCT), buffer, this.baseDir);
      } else if (cfg.PRINTER_TRANSPORT === Transport.BLUETOOTH) {
        await printSerial(cfg.PRINTER_SERIAL_PATH, buffer, this.baseDir);
      } else {
        await printWindows(this.baseDir, cfg.PRINTER_NAME, buffer);
      }
    };
    // Спулер печати/ОС иногда на мгновение отклоняет запуск (например,
    // "spawn EPERM" — на живом тесте это реально ловилось на первой попытке
    // печати сразу после старта агента). Одна автоматическая повторная
    // попытка через паузу — тот же приём, что у Velora в браузере
    // (web/src/lib/printerTransport.ts — printBytes).
    try {
      await send();
    } catch (err) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await send();
    }
    return "printed";
  }
}

module.exports = {
  Transport,
  listWindowsPrinters,
  listUsbDevices,
  listSerialPorts,
  MultiTransportInterface,
};
