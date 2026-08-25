// Собирает agent.js + все зависимости в один Windows .exe через встроенный
// в Node механизм Single Executable Applications — интернет не нужен,
// используется тот же node.exe, что уже стоит на этой машине.
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

async function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "menora-sea-"));
  try {
    fs.mkdirSync(path.join(staging, "dist"));

    console.log("1/4 Собираю agent.js и зависимости в один файл...");
    await esbuild.build({
      entryPoints: [path.join(ROOT, "agent.js")],
      bundle: true,
      platform: "node",
      target: "node22",
      format: "cjs",
      outfile: path.join(staging, "dist", "bundle.js"),
    });

    fs.writeFileSync(
      path.join(staging, "sea-config.json"),
      JSON.stringify({ main: "dist/bundle.js", output: "dist/sea-prep.blob", disableExperimentalSEAWarning: true }),
    );

    console.log("2/4 Генерирую SEA-блоб...");
    execFileSync(process.execPath, ["--experimental-sea-config", "sea-config.json"], { cwd: staging, stdio: "inherit" });

    console.log("3/4 Копирую node.exe как основу...");
    const exePath = path.join(staging, "dist", "menora-print.exe");
    fs.copyFileSync(process.execPath, exePath);

    console.log("4/4 Внедряю код в exe (postject)...");
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

    const shipped = new Set(["menora-print.exe", "install-autostart.bat", "Menora.vbs", "gui"]);
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
