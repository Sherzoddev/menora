import { NextRequest, NextResponse } from "next/server";

// Обратное геокодирование (координаты -> человекочитаемый адрес) для точки,
// выбранной на карте на чекауте — без него в поле адреса были бы голые
// координаты, бесполезные для курьера. Nominatim (OpenStreetMap): бесплатный,
// без API-ключа — единственный вариант без привязки к платному мерчанту/ключу
// на каждое заведение (в проекте пока нигде такого нет).
// Идём через свой роут, а не бьём Nominatim прямо из браузера: их usage policy
// требует User-Agent с указанием приложения, а браузерный fetch такой
// заголовок переопределить не даёт.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 6000;

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=ru&zoom=18`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MenoraQRMenu/1.0 (QR-menu SaaS for restaurants)" },
      signal: controller.signal,
    });
    if (!res.ok) return NextResponse.json({ address: null });

    const data = await res.json();
    const a = data.address ?? {};
    // Многие точки в Узбекистане в OSM не привязаны к конкретной улице
    // (road/pedestrian) — тогда раньше в адрес попадал только город. Теперь
    // добавлены neighbourhood/suburb/quarter (обычно это махалля, которая и
    // есть "точный адрес" для таких мест), плюс house_number если он есть.
    const street = a.road || a.pedestrian || a.footway || a.residential || a.neighbourhood || a.suburb || a.quarter || "";
    const house = a.house_number ? ` ${a.house_number}` : "";
    const area = a.city || a.town || a.village || a.county || "";

    let address: string | null;
    if (street) {
      address = area && area !== street ? `${street}${house}, ${area}` : `${street}${house}`;
    } else {
      // Даже махалли нет в разметке — берём несколько первых сегментов
      // display_name (Nominatim строит его от самого точного к общему),
      // это всё ещё точнее голого названия города.
      const segments = String(data.display_name ?? "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      address = segments.length ? segments.slice(0, 3).join(", ") : area || null;
    }
    return NextResponse.json({ address });
  } catch {
    // Nominatim недоступен/не ответил вовремя — не роняем чекаут, просто
    // возвращаем null и даём клиенту откатиться на координаты.
    return NextResponse.json({ address: null });
  } finally {
    clearTimeout(timeout);
  }
}
