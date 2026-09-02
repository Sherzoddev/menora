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
        // Bot API 7.7+/8.0+ — older Telegram clients don't have these, so
        // always feature-detect with isVersionAtLeast() before calling.
        isVersionAtLeast?: (version: string) => boolean;
        disableVerticalSwipes?: () => void;
        requestFullscreen?: () => void;
      };
    };
  }
}
