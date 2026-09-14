"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { MenuTheme } from "@/lib/menu-theme";
import { LIGHT_THEME } from "@/lib/menu-theme";

// Автоопределение по GPS зависит от точности устройства — в помещении или
// в Telegram WebView часто врёт на километры, из-за чего проверка радиуса
// доставки либо ложно блокирует, либо (что хуже) молчаливо не срабатывает
// вовсе, если гость просто вписал адрес текстом. Эта карта — единственный
// способ указать адрес доставки: гость сам двигает точку до точного места,
// координаты с неё идут и в адрес (как есть, без попытки угадать название
// улицы — это оказалось ненадёжным), и в проверку радиуса.
// Leaflet + OpenStreetMap — без API-ключа.
export default function AddressMapPicker({
  initial,
  theme = LIGHT_THEME,
  accent,
  onConfirm,
  onCancel,
}: {
  initial: { lat: number; lng: number };
  theme?: MenuTheme;
  accent: string;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const [coords, setCoords] = useState(initial);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { attributionControl: true }).setView(
        [initial.lat, initial.lng],
        16,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const icon = L.divIcon({
        html: '<div style="font-size:32px;line-height:32px;transform:translateY(-4px)">📍</div>',
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      const marker = L.marker([initial.lat, initial.lng], { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setCoords({ lat: pos.lat, lng: pos.lng });
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: theme.card,
          width: "100%",
          maxWidth: 480,
          borderRadius: "20px 20px 0 0",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 16px 6px", fontWeight: 600, fontSize: 15, color: theme.text }}>
          Передвиньте метку на точный адрес
        </div>
        <p style={{ margin: "0 16px 10px", fontSize: 12, color: theme.muted }}>
          Перетащите 📍 или тапните по карте, чтобы указать место точно
        </p>
        <div ref={containerRef} style={{ height: 340, width: "100%" }} />
        <div style={{ display: "flex", gap: 8, padding: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 12,
              border: `1px solid ${theme.border}`,
              background: "transparent",
              color: theme.muted,
              fontWeight: 500,
              fontSize: 14,
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onConfirm(coords)}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 12,
              border: "none",
              background: accent,
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
