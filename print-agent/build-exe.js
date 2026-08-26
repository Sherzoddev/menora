// Собирает agent.js + все зависимости в один Windows .exe через встроенный
// в Node механизм Single Executable Applications — интернет не нужен,
// используется тот же node.exe, что уже стоит на этой машине.
//
// Исключение — "usb" и "serialport": это нативные модули (скомпилированный
// .node-биндинг под конкретную ОС/архитектуру), SEA умеет встраивать в себя
// только чистый JS. Поэтому они остаются `external` при сборке бандла и
// копируются рядом с exe отдельной папкой node_modules — agent.js находит их
// там сам (см. printer-transport.js — loadNative/isSeaBinary).
//
// `node --experimental-sea-config` надёжно падает (segfault), если текущая
// папка содержит не-ASCII символы (у нас — "Рабочий стол") — поэтому этот
// шаг всегда выполняется во временной ASCII-папке, а не прямо в repo.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const esbuild = require("esbuild");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");
const NATIVE_EXTERNAL = ["usb", "serialport"];

// Пакеты, которые реально нужны в рантайме "usb" и "serialport" (посчитано
// по package-lock.json — полное транзитивное дерево, а не наугад). Копируем
// целиком, с нативными .node-биндингами внутри — на кухонном ПК ничего
// компилировать не придётся, там уже прикреплены готовые бинарники под
// нужную ОС/архитектуру.
const NATIVE_PACKAGES = [
  "usb",
  "@node-usb",
  "serialport",
  "@serialport",
  "@types/w3c-web-usb",
  "debug",
  "ms",
  "node-addon-api",
  "node-gyp-build",
];

// fs.cpSync здесь падает намертво (без исключения, которое можно поймать) —
// похоже, не справляется с файлами-плейсхолдерами OneDrive в node_modules
// (репозиторий лежит в синхронизируемой папке "Рабочий стол"). PowerShell
// Copy-Item с этим же деревом файлов работает надёжно — используем его.
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Copy-Item -LiteralPath '${src.replace(/'/g, "''")}' -Destination '${dest.replace(/'/g, "''")}' -Recurse -Force`,
  ]);
}

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "menora-sea-"));
  try {
    fs.mkdirSync(path.join(staging, "dist"));

    console.log("1/5 Собираю agent.js и зависимости в один файл...");
    await esbuild.build({
      entryPoints: [path.join(ROOT, "agent.js")],
      bundle: true,
      platform: "node",
      target: "node22",
      format: "cjs",
      external: NATIVE_EXTERNAL,
      outfile: path.join(staging, "dist", "bundle.js"),
    });

    fs.writeFileSync(
      path.join(staging, "sea-config.json"),
      JSON.stringify({ main: "dist/bundle.js", output: "dist/sea-prep.blob", disableExperimentalSEAWarning: true }),
    );

    console.log("2/5 Генерирую SEA-блоб...");
    execFileSync(process.execPath, ["--experimental-sea-config", "sea-config.json"], { cwd: staging, stdio: "inherit" });

    console.log("3/5 Копирую node.exe как основу...");
    const exePath = path.join(staging, "dist", "menora-print.exe");
    fs.copyFileSync(process.execPath, exePath);

    console.log("4/5 Внедряю код в exe (postject)...");
    execFileSync(
      process.execPath,
      [
        require.resolve("postject/dist/cli.js"),
        exePath,
        "NODE_SEA_BLOB",
        path.join(staging, "dist", "sea-prep.blob"),
        "--sentinel-fuse",
        "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
      ],
      { stdio: "inherit" },
    );

    fs.copyFileSync(exePath, path.join(DIST, "menora-print.exe"));
    fs.copyFileSync(path.join(ROOT, "autostart-template.bat"), path.join(DIST, "install-autostart.bat"));
    fs.copyFileSync(path.join(ROOT, "Menora.vbs"), path.join(DIST, "Menora.vbs"));
    fs.mkdirSync(path.join(DIST, "gui"), { recursive: true });
    fs.copyFileSync(path.join(ROOT, "gui", "setup-gui.ps1"), path.join(DIST, "gui", "setup-gui.ps1"));

    console.log("5/5 Копирую нативные модули (usb, serialport)...");
    const destModules = path.join(DIST, "node_modules");
    for (const name of NATIVE_PACKAGES) {
      process.stdout.write(`   ...${name}\n`);
      try {
        copyDir(path.join(ROOT, "node_modules", name), path.join(destModules, name));
      } catch (err) {
        console.error(`   !!! не удалось скопировать ${name}:`, err);
        throw err;
      }
    }

    const shipped = new Set(["menora-print.exe", "install-autostart.bat", "Menora.vbs", "gui", "node_modules"]);
    // OneDrive briefly locks freshly-written files for cloud-sync scanning,
    // which can make an rm-then-rebuild leave a stale intermediate file
    // behind — belt-and-braces cleanup of anything that isn't what we ship.
    for (const name of fs.readdirSync(DIST)) {
      if (!shipped.has(name)) {
        fs.rmSync(path.join(DIST, name), { recursive: true, force: true });
      }
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }

  console.log(`\n✅ Готово: ${path.join(DIST, "menora-print.exe")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
