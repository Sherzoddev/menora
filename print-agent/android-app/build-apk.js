// Собирает Android APK без Gradle — компилятором javac, дексером d8,
// упаковщиком ресурсов aapt2 и подписью apksigner напрямую (все из
// Android SDK command-line tools + отдельно скачанного JDK). Gradle
// специально не используется — его собственная загрузка + разрешение
// Maven-зависимостей были бы ещё одним медленным сетевым шагом поверх уже
// медленной сети в этой среде.
//
// Вся сборка целиком идёт во временной ASCII-папке, а не прямо в repo:
// aapt2 (нативный инструмент, не Java) не может открыть папку с кириллицей
// в пути ("Рабочий стол") — падает с "failed to open directory". d8.jar
// запускается напрямую через java (не d8.bat), потому что .bat на Windows
// можно вызвать только через cmd.exe, а тот портит кириллицу в аргументах.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT = __dirname;
const OUT = path.join(ROOT, "build-out");

const JAVA_HOME = process.env.MENORA_JAVA_HOME;
const ANDROID_SDK = process.env.MENORA_ANDROID_SDK;
const BUILD_TOOLS_VERSION = process.env.MENORA_BUILD_TOOLS || "34.0.0";
const PLATFORM = process.env.MENORA_PLATFORM || "android-34";

if (!JAVA_HOME || !ANDROID_SDK) {
  console.error("Задайте переменные окружения MENORA_JAVA_HOME и MENORA_ANDROID_SDK перед запуском.");
  process.exit(1);
}

process.env.JAVA_HOME = JAVA_HOME;
process.env.PATH = `${path.join(JAVA_HOME, "bin")}${path.delimiter}${process.env.PATH}`;

const javac = path.join(JAVA_HOME, "bin", "javac.exe");
const java = path.join(JAVA_HOME, "bin", "java.exe");
const keytool = path.join(JAVA_HOME, "bin", "keytool.exe");
const buildTools = path.join(ANDROID_SDK, "build-tools", BUILD_TOOLS_VERSION);
const d8Jar = path.join(buildTools, "lib", "d8.jar");
const aapt2 = path.join(buildTools, "aapt2.exe");
const apksignerJar = path.join(buildTools, "lib", "apksigner.jar");
const zipalign = path.join(buildTools, "zipalign.exe");
const androidJar = path.join(ANDROID_SDK, "platforms", PLATFORM, "android.jar");

function run(cmd, args, opts) {
  console.log(">", cmd, args.join(" "));
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dest, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  for (const p of [javac, java, buildTools, androidJar]) {
    if (!fs.existsSync(p)) {
      console.error(`Не найдено: ${p}`);
      process.exit(1);
    }
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "menora-apk-"));
  const stSrc = path.join(staging, "src");
  const stRes = path.join(staging, "res");
  const stManifest = path.join(staging, "AndroidManifest.xml");
  const stOut = path.join(staging, "out");
  const stClasses = path.join(stOut, "classes");

  try {
    copyDir(path.join(ROOT, "src"), stSrc);
    copyDir(path.join(ROOT, "res"), stRes);
    fs.copyFileSync(path.join(ROOT, "AndroidManifest.xml"), stManifest);
    fs.mkdirSync(stClasses, { recursive: true });

    console.log("1/7 Компилирую Java-исходники...");
    const javaFiles = fs
      .readdirSync(path.join(stSrc, "uz", "menora", "printagent"))
      .filter((f) => f.endsWith(".java"))
      .map((f) => path.join(stSrc, "uz", "menora", "printagent", f));
    run(javac, [
      "-encoding", "UTF-8",
      "-source", "8", "-target", "8",
      // android.jar как -classpath (не -bootclasspath) — иначе javac не
      // находит LambdaMetafactory для лямбд (в android.jar его нет, он
      // есть только в самом JDK). D8 ниже сам десахарит лямбды под старые
      // версии Android.
      "-classpath", androidJar,
      "-d", stClasses,
      ...javaFiles,
    ]);

    console.log("2/7 Перевожу в DEX (d8)...");
    const classFiles = [];
    (function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".class")) classFiles.push(full);
      }
    })(stClasses);
    run(java, ["-Xmx1024M", "-Xss1m", "-cp", d8Jar, "com.android.tools.r8.D8", "--output", stOut, "--min-api", "26", ...classFiles]);

    console.log("3/7 Компилирую ресурсы (aapt2 compile)...");
    const compiledResZip = path.join(stOut, "compiled_res.zip");
    run(aapt2, ["compile", "--dir", stRes, "-o", compiledResZip]);

    console.log("4/7 Линкую манифест + ресурсы (aapt2 link)...");
    const unsignedApk = path.join(stOut, "app-unsigned.apk");
    run(aapt2, [
      "link",
      "-o", unsignedApk,
      "-I", androidJar,
      "--manifest", stManifest,
      "-R", compiledResZip,
      "--auto-add-overlay",
    ]);

    console.log("5/7 Добавляю classes.dex в APK...");
    const jarTool = path.join(JAVA_HOME, "bin", "jar.exe");
    run(jarTool, ["uf", unsignedApk, "-C", stOut, "classes.dex"]);

    console.log("6/7 Выравниваю (zipalign)...");
    const alignedApk = path.join(stOut, "app-aligned.apk");
    run(zipalign, ["-f", "4", unsignedApk, alignedApk]);

    console.log("7/7 Подписываю (debug-ключ)...");
    // Ключ должен быть один и тот же между сборками — иначе Android не
    // даст поставить новую версию поверх старой (конфликт подписи,
    // "App not installed"). Кладём его в repo (не в staging, который
    // удаляется после каждой сборки), но само подписание всё равно
    // выполняется без изменений — keytool.exe тут работает с кириллицей
    // в пути нормально (не .bat, вызывается напрямую, не через cmd.exe).
    const keystorePath = path.join(ROOT, "debug.keystore");
    if (!fs.existsSync(keystorePath)) {
      run(keytool, [
        "-genkeypair", "-v",
        "-keystore", keystorePath,
        "-storepass", "android", "-keypass", "android",
        "-alias", "menoradebug",
        "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
        "-dname", "CN=Menora, OU=Menora, O=Menora, L=Tashkent, S=Tashkent, C=UZ",
      ]);
    }
    const finalApkStaging = path.join(stOut, "menora-print.apk");
    run(java, [
      "-jar", apksignerJar, "sign",
      "--ks", keystorePath, "--ks-pass", "pass:android",
      "--out", finalApkStaging,
      alignedApk,
    ]);

    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    const finalApk = path.join(OUT, "menora-print.apk");
    fs.copyFileSync(finalApkStaging, finalApk);

    console.log(`\n✅ Готово: ${finalApk}`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

main();
