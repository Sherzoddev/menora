"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Layer, Map as LeafletMap, TileLayer } from "leaflet";
import { ChevronLeft, Layers, LocateFixed, Minus, Plus } from "lucide-react";
import type { VenueLocation } from "@/lib/geo";
import { distanceKm } from "@/lib/geo";

type Point = { lat: number; lng: number };

// Карта — единственный способ указать адрес доставки, и именно эта точка
// (а не текст адреса) потом уходит курьеру как маршрут и геометка, поэтому
// всё здесь заточено под одно: поставить метку ровно на свой дом.
//
// - Метка закреплена в центре экрана, двигается сама карта: на телефоне это
//   точнее, чем таскать маркер пальцем, который его же и закрывает.
// - «Спутник»: в сёлах и махаллях схема OSM почти пустая, а на снимке гость
//   узнаёт свою крышу и ворота.
// - Геолокация только подводит карту к месту — в помещении и в Telegram
//   WebView она врёт на десятки метров, поэтому точку гость всё равно
//   подтверждает глазами.
// Leaflet + OpenStreetMap/Esri — без API-ключей.
const LAYER_PREF_KEY = "menora-map-layer";
const MIN_PRECISE_ZOOM = 16;

export default function AddressMapPicker({
  initial,
  autoLocate,
  venueLocation = null,
  onConfirm,
  onCancel,
}: {
  initial: Point;
  // true, когда точки ещё нет и initial — лишь стартовый вид (заведение или
  // центр города): тогда сразу пробуем подвести карту по геолокации.
  autoLocate: boolean;
  venueLocation?: VenueLocation | null;
  onConfirm: (coords: Point) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<{ scheme: TileLayer; satellite: Layer } | null>(null);
  const locateRef = useRef<(silent: boolean) => void>(() => {});
  const [center, setCenter] = useState<Point>(initial);
  const [zoom, setZoom] = useState(autoLocate ? 15 : 18);
  const [moving, setMoving] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const el = containerRef.current;
      if (cancelled || !el || mapRef.current) return;

      const accent = getComputedStyle(el).getPropertyValue("--mn-accent").trim() || "#c9722c";

      const map = L.map(el, {
        zoomControl: false,
        attributionControl: true,
        // Зум всегда вокруг центра — метка не «уезжает» с дома, когда гость
        // приближает карту щипком или двойным тапом.
        touchZoom: "center",
        scrollWheelZoom: "center",
        doubleClickZoom: "center",
      }).setView([initial.lat, initial.lng], autoLocate ? 15 : 18);
      map.attributionControl.setPrefix(false);

      const scheme = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 20,
        maxNativeZoom: 19,
        attribution: "© OpenStreetMap",
      });
      const satellite = L.layerGroup([
        // maxNativeZoom 17: глубже у Esri в сёлах (проверено на Джуме) вместо
        // снимка приходит серая плитка-заглушка. Дальше Leaflet просто
        // растягивает 17-й уровень — чуть мыльно, зато дом всегда видно.
        L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 20,
          maxNativeZoom: 17,
          attribution: "© Esri",
        }),
        // Подписи улиц и посёлков поверх снимка — иначе на спутнике не
        // сориентироваться.
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 20, maxNativeZoom: 17, zIndex: 2 },
        ),
      ]);
      layersRef.current = { scheme, satellite };

      let startSatellite = false;
      try {
        startSatellite = localStorage.getItem(LAYER_PREF_KEY) === "satellite";
      } catch {
        // ignore
      }
      (startSatellite ? satellite : scheme).addTo(map);
      setSatellite(startSatellite);

      if (venueLocation) {
        if (venueLocation.radiusKm != null) {
          L.circle([venueLocation.lat, venueLocation.lng], {
            radius: venueLocation.radiusKm * 1000,
            color: accent,
            weight: 2,
            dashArray: "6 8",
            fillColor: accent,
            fillOpacity: 0.05,
            interactive: false,
          }).addTo(map);
        }
        L.circleMarker([venueLocation.lat, venueLocation.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: accent,
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);
      }

      map.on("movestart", () => setMoving(true));
      map.on("moveend", () => {
        const c = map.getCenter();
        setCenter({ lat: c.lat, lng: c.lng });
        setZoom(map.getZoom());
        setMoving(false);
      });
      map.on("click", (e) => map.panTo(e.latlng));

      let meDot: Layer | null = null;
      locateRef.current = (silent) => {
        if (!navigator.geolocation) {
          if (!silent) setNote("Геолокация недоступна — передвиньте карту вручную");
          return;
        }
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (cancelled) return;
            setLocating(false);
            const { latitude, longitude, accuracy } = pos.coords;
            meDot?.remove();
            meDot = L.layerGroup([
              L.circle([latitude, longitude], {
                radius: accuracy,
                color: "#2b7fff",
                weight: 1,
                fillColor: "#2b7fff",
                fillOpacity: 0.12,
                interactive: false,
              }),
              L.circleMarker([latitude, longitude], {
                radius: 6,
                color: "#ffffff",
                weight: 2,
                fillColor: "#2b7fff",
                fillOpacity: 1,
                interactive: false,
              }),
            ]).addTo(map);
            map.setView([latitude, longitude], accuracy > 200 ? 16 : 18);
            setNote(
              accuracy > 60
                ? `Геолокация неточная (±${Math.round(accuracy)} м) — поправьте метку по карте`
                : "Проверьте: метка должна стоять на вашем доме",
            );
          },
          () => {
            if (cancelled) return;
            setLocating(false);
            if (!silent) setNote("Не удалось определить местоположение — передвиньте карту вручную");
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        );
      };

      mapRef.current = map;
      // Контейнер только что получил размеры (оверлей появился с анимацией) —
      // без этого Leaflet иногда рисует серую половину карты.
      setTimeout(() => map.invalidateSize(), 60);
      if (autoLocate) locateRef.current(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleLayer() {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    const next = !satellite;
    map.removeLayer(next ? layers.scheme : layers.satellite);
    map.addLayer(next ? layers.satellite : layers.scheme);
    setSatellite(next);
    try {
      localStorage.setItem(LAYER_PREF_KEY, next ? "satellite" : "scheme");
    } catch {
      // ignore
    }
  }

  const distance = venueLocation ? distanceKm(venueLocation.lat, venueLocation.lng, center.lat, center.lng) : null;
  const outOfRadius = distance != null && venueLocation?.radiusKm != null && distance > venueLocation.radiusKm;
  const tooFar = zoom < MIN_PRECISE_ZOOM;

  return (
    <div className="mn-fade fixed inset-0 z-[1000] flex flex-col bg-[var(--mn-bg)] text-[color:var(--mn-text)]">
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0 z-0" />

        {/* Метка: остриё стоит ровно в центре карты */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10">
          <div
            className="absolute left-0 top-0 h-2.5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/30 blur-[2px] transition-transform duration-150"
            style={{ transform: `translate(-50%, -50%) scale(${moving ? 0.6 : 1})` }}
          />
          <svg
            width="46"
            height="58"
            viewBox="0 0 46 58"
            className="absolute left-0 top-0 drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)] transition-transform duration-150"
            style={{ transform: `translate(-50%, calc(-100% - ${moving ? 12 : 0}px))` }}
            aria-hidden
          >
            <path
              d="M23 57C23 57 44 36.5 44 22.5C44 10.6 34.6 1 23 1C11.4 1 2 10.6 2 22.5C2 36.5 23 57 23 57Z"
              fill="var(--mn-accent)"
              stroke="#fff"
              strokeWidth="2"
            />
            <circle cx="23" cy="22" r="8" fill="#fff" />
          </svg>
        </div>

        {/* Верх: назад + подпись */}
        <div
          className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3"
          style={{ paddingTop: "calc(12px + var(--mn-safe-top))" }}
        >
          <button
            type="button"
            onClick={onCancel}
            aria-label="Назад"
            className="mn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--mn-card)] shadow-lg"
          >
            <ChevronLeft size={22} />
          </button>
          <div className="rounded-full bg-[var(--mn-card)] px-4 py-2.5 text-[13px] font-semibold shadow-lg">
            Двигайте карту — метка стоит на месте
          </div>
        </div>

        {/* Справа: слой, зум, геолокация */}
        <div className="absolute bottom-4 right-3 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={toggleLayer}
            className="mn-press flex h-11 items-center gap-1.5 rounded-full bg-[var(--mn-card)] px-3.5 text-[13px] font-semibold shadow-lg"
          >
            <Layers size={17} />
            {satellite ? "Схема" : "Спутник"}
          </button>
          <div className="flex flex-col overflow-hidden rounded-2xl bg-[var(--mn-card)] shadow-lg">
            <button type="button" aria-label="Приблизить" onClick={() => mapRef.current?.zoomIn()} className="flex h-11 w-11 items-center justify-center">
              <Plus size={19} />
            </button>
            <div className="h-px bg-[var(--mn-border)]" />
            <button type="button" aria-label="Отдалить" onClick={() => mapRef.current?.zoomOut()} className="flex h-11 w-11 items-center justify-center">
              <Minus size={19} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => locateRef.current(false)}
            aria-label="Моё местоположение"
            className={`mn-press flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mn-accent)] text-[color:var(--mn-on-accent)] shadow-lg ${locating ? "mn-pulse" : ""}`}
          >
            <LocateFixed size={21} />
          </button>
        </div>
      </div>

      <div
        className="relative z-10 -mt-5 rounded-t-[28px] bg-[var(--mn-card)] px-4 pt-4 shadow-[0_-10px_30px_rgba(0,0,0,0.12)]"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      >
        <p className="mn-display text-[17px] font-bold leading-tight">Куда привезти заказ?</p>
        <p className="mt-1 text-[13px] leading-snug text-[color:var(--mn-muted)]">
          Поставьте метку на свой дом или подъезд — курьер получит именно эту точку.
        </p>

        {outOfRadius && distance != null && venueLocation?.radiusKm != null ? (
          <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-500">
            Сюда не доставляем: {distance.toFixed(1)} км от заведения, зона доставки — {venueLocation.radiusKm} км.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
            {distance != null && (
              <span className="font-semibold">
                {distance < 1 ? `${Math.round(distance * 1000)} м` : `${distance.toFixed(1)} км`} от заведения
              </span>
            )}
            {note && <span className="text-[color:var(--mn-muted)]">{note}</span>}
          </div>
        )}

        <button
          type="button"
          disabled={moving || outOfRadius}
          onClick={() => {
            // С общего плана метка покрывает целый квартал — сначала
            // приближаем, чтобы гость увидел, на какой дом она смотрит.
            if (tooFar) mapRef.current?.setZoom(17);
            else onConfirm(center);
          }}
          className="mn-press mt-3 w-full rounded-2xl bg-[var(--mn-accent)] px-4 py-4 text-[15px] font-bold text-[color:var(--mn-on-accent)] disabled:opacity-50"
        >
          {tooFar ? "Приблизить, чтобы указать точно" : "Доставить сюда"}
        </button>
      </div>
    </div>
  );
}
