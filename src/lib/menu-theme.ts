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
  bg: "#FBF3E6",
  card: "#FFFFFF",
  cardMuted: "#f1e9da",
  text: "#3a2f22",
  muted: "#8a7a63",
  mutedLight: "#b3a48c",
  border: "#e7ddcd",
  inputBg: "#fffdf9",
  overlayFrom: "#FBF3E6",
};

export const DARK_THEME: MenuTheme = {
  bg: "#0c100e",
  card: "#161d19",
  cardMuted: "#1e2621",
  text: "#eef2ef",
  muted: "#8fa199",
  mutedLight: "#5c6b64",
  border: "#263029",
  inputBg: "#111512",
  overlayFrom: "#0c100e",
};

export function getMenuTheme(dark: boolean): MenuTheme {
  return dark ? DARK_THEME : LIGHT_THEME;
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
