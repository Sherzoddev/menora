// Точка доставки, которую гость поставил на карте, едет вместе с заказом в
// самом orders.address — в конце строки, в виде "(lat, lng)":
//   "Джума · зелёные ворота, напротив школы №5 (39.712427, 66.662971)"
//
// Раньше координаты использовались только для проверки радиуса и нигде не
// сохранялись, а маршрут курьеру строился по тексту адреса. В сёлах и
// махаллях обратное геокодирование даёт в лучшем случае название посёлка
// ("Джума"), и курьер получал маршрут "в посёлок", а не к дому. Отдельной
// колонки под координаты в orders нет, поэтому формат выбран так, чтобы
// строка оставалась читаемой и там, где её показывают как есть (например,
// уже установленный у заведений print-agent).
export type DeliveryPoint = { lat: number; lng: number };

const COORDS_RE = /\s*\((-?\d{1,2}\.\d{4,7}),\s*(-?\d{1,3}\.\d{4,7})\)\s*$/;

export function isValidPoint(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // (0, 0) — это не адрес, а несработавшая геолокация.
    !(lat === 0 && lng === 0)
  );
}

export function composeAddress(text: string, details: string, point: DeliveryPoint | null): string {
  // Скобки с координатами — служебный хвост; убираем такой же хвост из
  // введённого руками текста, чтобы он не спорил с настоящей точкой.
  const base = [text.replace(COORDS_RE, "").trim(), details.trim()].filter(Boolean).join(" · ");
  if (!point) return base;
  const coords = `(${point.lat.toFixed(6)}, ${point.lng.toFixed(6)})`;
  return base ? `${base} ${coords}` : coords;
}

export function parseAddress(stored: string | null | undefined): { text: string; point: DeliveryPoint | null } {
  const raw = (stored ?? "").trim();
  const m = raw.match(COORDS_RE);
  if (!m) return { text: raw, point: null };
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!isValidPoint(lat, lng)) return { text: raw, point: null };
  return { text: raw.slice(0, m.index).trim(), point: { lat, lng } };
}

// Ссылки ведут ровно в точку гостя, а старт обе карты берут из текущего
// положения курьера. Для старых заказов без точки — как раньше, по тексту.
export function routeUrls(stored: string): { google: string; yandex: string } {
  const { text, point } = parseAddress(stored);
  const dest = point ? `${point.lat},${point.lng}` : encodeURIComponent(text);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    yandex: `https://yandex.ru/maps/?rtext=~${dest}&rtt=auto`,
  };
}

export function pointUrl(point: DeliveryPoint): string {
  return `https://maps.google.com/?q=${point.lat},${point.lng}`;
}
