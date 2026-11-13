// Переезд на новый адрес: перепрописывает у Telegram-ботов всех заведений
// (и у бота-администратора) webhook и кнопку «Меню» на новый домен.
//
//   node scripts/move-bots.mjs https://новый-адрес.netlify.app            — только посмотреть (ничего не меняет)
//   node scripts/move-bots.mjs https://новый-адрес.netlify.app --apply    — применить
//   ... --apply --drop-pending   — ещё и выбросить накопившиеся за время простоя сообщения
//
// Ключи берутся из .env.local самого проекта и никуда не печатаются.
// Запускать из папки БЕЗ кириллицы в пути (например, `cd C:\`), иначе node падает.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const newSite = (args.find((a) => a.startsWith("http")) ?? "").replace(/\/+$/, "");
const apply = args.includes("--apply");
const dropPending = args.includes("--drop-pending");
if (!newSite) {
  console.error("Укажите новый адрес: node scripts/move-bots.mjs https://....netlify.app [--apply]");
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("В .env.local нет NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const tg = async (token, method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
};

console.log(`${apply ? "ПРИМЕНЯЮ" : "ПРОВЕРКА (без изменений)"} → ${newSite}\n`);

const rows = await (
  await fetch(
    `${SUPABASE_URL}/rest/v1/venues?select=id,name,slug,telegram_bot_token,telegram_chat_id&telegram_bot_token=not.is.null&order=name.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  )
).json();
if (!Array.isArray(rows)) {
  console.error("Не удалось прочитать заведения:", JSON.stringify(rows).slice(0, 200));
  process.exit(1);
}
console.log(`Заведений с подключённым ботом: ${rows.length}\n`);

let ok = 0, failed = 0;
for (const v of rows) {
  const token = v.telegram_bot_token;
  const target = `${newSite}/api/telegram/webhook/${v.id}`;
  const info = await tg(token, "getWebhookInfo");
  const cur = info.result?.url ?? "(нет)";
  const pending = info.result?.pending_update_count ?? 0;
  const lastErr = info.result?.last_error_message ? ` · ошибка: ${info.result.last_error_message}` : "";
  const state = cur === target ? "уже на новом адресе" : cur.includes("vercel.app") ? "на мёртвом Vercel" : "на другом адресе";
  console.log(`• ${v.name} (/${v.slug}) — ${state}, в очереди ${pending}${lastErr}`);
  if (!apply) continue;

  const hook = await tg(token, "setWebhook", { url: target, ...(dropPending ? { drop_pending_updates: true } : {}) });
  // Кнопка «Меню» для всех чатов + для привязанного чата сотрудников — как в webhook/[venueId]/route.ts.
  const menu = await tg(token, "setChatMenuButton", {
    menu_button: { type: "web_app", text: "Меню", web_app: { url: `${newSite}/${v.slug}` } },
  });
  let staffMenu = { ok: true };
  if (v.telegram_chat_id) {
    staffMenu = await tg(token, "setChatMenuButton", {
      chat_id: Number(v.telegram_chat_id),
      menu_button: { type: "web_app", text: "Меню", web_app: { url: `${newSite}/cabinet` } },
    });
  }
  const good = hook.ok && menu.ok && staffMenu.ok;
  good ? ok++ : failed++;
  console.log(`    webhook: ${hook.ok ? "OK" : "ОШИБКА " + hook.description} · меню: ${menu.ok ? "OK" : "ОШИБКА " + menu.description}${v.telegram_chat_id ? " · меню сотрудников: " + (staffMenu.ok ? "OK" : "ОШИБКА " + staffMenu.description) : ""}`);
}

// Бот-администратор Меноры (route /api/telegram/admin).
if (env.MENORA_ADMIN_BOT_TOKEN) {
  const t = env.MENORA_ADMIN_BOT_TOKEN;
  const info = await tg(t, "getWebhookInfo");
  console.log(`\n• Бот-администратор — сейчас: ${info.result?.url ?? "(нет)"}, в очереди ${info.result?.pending_update_count ?? 0}`);
  if (apply) {
    const hook = await tg(t, "setWebhook", {
      url: `${newSite}/api/telegram/admin`,
      ...(env.MENORA_ADMIN_WEBHOOK_SECRET ? { secret_token: env.MENORA_ADMIN_WEBHOOK_SECRET } : {}),
      allowed_updates: ["message", "callback_query"],
      ...(dropPending ? { drop_pending_updates: true } : {}),
    });
    hook.ok ? ok++ : failed++;
    console.log(`    webhook: ${hook.ok ? "OK" : "ОШИБКА " + hook.description}`);
  }
}

console.log(apply ? `\nГотово: успешно ${ok}, с ошибками ${failed}.` : "\nЭто была проверка. Чтобы переключить ботов, добавьте --apply.");
