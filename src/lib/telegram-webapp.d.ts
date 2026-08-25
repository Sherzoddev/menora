// Minimal ambient typing for the Telegram Mini App SDK
// (https://telegram.org/js/telegram-web-app.js), loaded via <Script> in
// src/app/[slug]/page.tsx. Only the surface this project actually uses.
export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
      };
    };
  }
}
