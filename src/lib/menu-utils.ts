const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function formatPrice(value: number, currency: string) {
  const formatted = new Intl.NumberFormat("ru-RU").format(value);
  return `${formatted} ${currency === "UZS" ? "сум" : currency}`;
}

export function isOpenNow(workingHours: Record<string, string> | null | undefined): boolean | null {
  if (!workingHours || Object.keys(workingHours).length === 0) return null;

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }),
  );
  const todayKey = DAY_KEYS[now.getDay()];
  const range = workingHours[todayKey];
  if (!range) return false;

  const [start, end] = range.split("-").map((t) => t.trim());
  if (!start || !end) return null;

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (endMinutes >= startMinutes) {
    return minutesNow >= startMinutes && minutesNow <= endMinutes;
  }
  // overnight range, e.g. 20:00-02:00
  return minutesNow >= startMinutes || minutesNow <= endMinutes;
}

export function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DAY_LABELS_RU: Record<string, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс",
};
