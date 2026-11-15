import type { CSSProperties } from "react";

// Светлая/тёмная палитра публичного меню — сам акцентный цвет (accent)
// у каждого заведения свой (venues.accent_color) и не входит сюда, тема
// меняет только фон/текст/карточки вокруг него.
export type MenuTheme = {
  bg: string;
  card: string;
  cardMuted: string;
  text: string;
  muted: string;
  mutedLight: string;
  border: string;
  inputBg: string;
  overlayFrom: string;
};

export const LIGHT_THEME: MenuTheme = {
  bg: "#F4F2ED",
  card: "#FFFFFF",
  cardMuted: "#ECE8E0",
  text: "#14120E",
  muted: "#6E695F",
  mutedLight: "#A7A195",
  border: "#E3DED4",
  inputBg: "#FFFFFF",
  overlayFrom: "#F4F2ED",
};

export const DARK_THEME: MenuTheme = {
  bg: "#0C0C0D",
  card: "#18181A",
  cardMuted: "#242427",
  text: "#F5F3EE",
  muted: "#9B978E",
  mutedLight: "#65625C",
  border: "#2A2A2E",
  inputBg: "#131315",
  overlayFrom: "#0C0C0D",
};

export function getMenuTheme(dark: boolean): MenuTheme {
  return dark ? DARK_THEME : LIGHT_THEME;
}

// Цвет текста/иконок поверх акцентной заливки. Акцент задаёт владелец
// заведения, и он может оказаться светлым (жёлтый, салатовый) — белый
// текст на нём пропадает.
export function onAccent(accent: string): string {
  const hex = accent.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#FFFFFF";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#14120E" : "#FFFFFF";
}

// Все цвета меню (и всего, что открывается поверх него — корзина, чекаут,
// карта) приходят через CSS-переменные на корневом элементе: компоненты
// ниже ссылаются на var(--mn-*) и не знают, светлая сейчас тема или тёмная.
export function themeVars(theme: MenuTheme, accent: string): CSSProperties {
  return {
    ["--mn-bg" as string]: theme.bg,
    ["--mn-card" as string]: theme.card,
    ["--mn-card-muted" as string]: theme.cardMuted,
    ["--mn-text" as string]: theme.text,
    ["--mn-muted" as string]: theme.muted,
    ["--mn-muted-light" as string]: theme.mutedLight,
    ["--mn-border" as string]: theme.border,
    ["--mn-input" as string]: theme.inputBg,
    ["--mn-accent" as string]: accent,
    ["--mn-on-accent" as string]: onAccent(accent),
    background: theme.bg,
    color: theme.text,
  };
}

const STORAGE_PREFIX = "menora-theme-";

export function loadThemePref(venueId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + venueId) === "dark";
  } catch {
    return false;
  }
}

export function saveThemePref(venueId: string, dark: boolean) {
  try {
    localStorage.setItem(STORAGE_PREFIX + venueId, dark ? "dark" : "light");
  } catch {
    // ignore
  }
}
