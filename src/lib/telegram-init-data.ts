import { createHmac } from "crypto";

export type TelegramWebAppUser = {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

// Verifies the `initData` string a Telegram Mini App hands to its frontend
// (window.Telegram.WebApp.initData) per Telegram's documented algorithm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// This is the only thing standing between "the client claims to be Telegram
// user X" and actually trusting it — the HMAC is keyed on the venue's own
// bot token, so a forged initData from an unrelated bot/venue won't verify.
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 24 * 60 * 60,
): TelegramWebAppUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computedHash !== hash) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return null;

  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson);
    if (typeof user.id !== "number") return null;
    return {
      id: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
    };
  } catch {
    return null;
  }
}
