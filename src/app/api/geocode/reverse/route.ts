import { NextRequest, NextResponse } from "next/server";

// Обратное геокодирование (координаты -> человекочитаемый адрес) для точки,
// выбранной на карте на чекауте — только для подписи в поле адреса. Маркер
// на карте всегда остаётся ровно там, куда его поставил гость: координаты,
// которые уходят на сервер для проверки радиуса и курьеру, берутся из
// клика/драга на карте (address-map-picker.tsx), а не из ответа Nominatim —
// этот роут им не возвращается вовсе.
//
// Nominatim reverse ищет не "точный адрес этой точки", а ближайший подходящий
// объект OSM, поэтому там, где адреса размечены неполно (частая ситуация для
// Узбекистана), он может привязаться к соседнему дому/улице. layer=address
// хотя бы исключает попадание в ближайший магазин/кафе вместо адреса.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 6000;

export async function GET(req: NextRequest) {
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "invalid coordinates" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "1",
      layer: "address",
      "accept-language": "ru,uz,en",
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": "MenoraQRMenu/1.0 (QR-menu SaaS for restaurants)" },
      signal: controller.signal,
      // Одна и та же точка (гость двигает пин туда-сюда, отменяет и снова
      // открывает карту) не должна каждый раз бить по публичному Nominatim —
      // у него жёсткий лимит ~1 запрос/сек на всё приложение.
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ address: null });

    const data = await res.json();
    const a = data.address ?? {};

    // Раньше улица и махалля/район смешивались в одну переменную — из-за
    // этого, например, "Chilonzor-7" (neighbourhood) выводился так, будто
    // это название улицы. Разделяем на явные роли.
    const road = a.road || a.pedestrian || a.residential || a.footway || "";
    const house = a.house_number || "";
    const neighbourhood = a.neighbourhood || a.quarter || a.suburb || a.city_district || "";
    const city = a.city || a.town || a.village || a.municipality || a.county || "";

    const parts: string[] = [];
    if (road) parts.push(house ? `${road}, ${house}` : road);
    else if (neighbourhood) parts.push(neighbourhood);
    if (city && city !== neighbourhood) parts.push(city);

    let address: string | null = parts.length ? parts.join(", ") : null;
    if (!address) {
      // Совсем ничего адресного не нашлось — берём первые сегменты
      // display_name (Nominatim строит его от точного к общему), это всё
      // ещё лучше, чем просто отказаться от подписи.
      const segments = String(data.display_name ?? "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
      address = segments.length ? segments.slice(0, 4).join(", ") : null;
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
