export type VenueLocation = { lat: number; lng: number; radiusKm: number | null };

// Расстояние по прямой между двумя точками (формула гаверсинуса) — этого
// достаточно для проверки "гость дальше радиуса доставки", реальный
// маршрут курьера всегда будет чуть длиннее по прямой, что для этой
// проверки только на пользу (более строгая граница).
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
