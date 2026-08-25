"use client";

import { Fragment, useEffect, useState } from "react";
import { getOrderTrackingState } from "./actions";

const STAGES = [
  { key: "new", label: "Принят", icon: "📝" },
  { key: "preparing", label: "Готовится", icon: "🍳" },
  { key: "ready", label: "Готов", icon: "✅" },
  { key: "sent", label: "Отправлен", icon: "🛵" },
] as const;

// Курьер приходит от такси — реального GPS нет и не будет. Вместо
// молчаливой заглушки или вымышленной точки на карте — честная полоса
// прогресса по времени с игривой иконкой поверх: не претендует на "где
// именно едет", но создаёт ощущение движения. 30 минут — та же оценка, что
// уже используется для запроса отзыва (send_due_rating_requests).
const ESTIMATED_DELIVERY_MS = 30 * 60 * 1000;
const POLL_MS = 5000;

export function OrderTracker({
  orderId,
  initialStatus,
  initialSentAt,
  fulfillment,
  accent,
}: {
  orderId: string;
  initialStatus: string;
  initialSentAt: string | null;
  fulfillment: string;
  accent: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [sentAt, setSentAt] = useState(initialSentAt);
  // Date.now() не читаем прямо в рендере (impure) — только сюда, в эффекте.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let alive = true
    const poll = async () => {
      const state = await getOrderTrackingState(orderId);
      if (!alive || !state) return;
      setStatus(state.status);
      setSentAt(state.sentAt);
    };
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [orderId]);

  // Полоса прогресса растёт по часам, а не по опросу сервера — своя
  // секундная перерисовка, независимая от POLL_MS.
  useEffect(() => {
    if (status !== "sent" || fulfillment !== "delivery") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status, fulfillment]);

  const stageIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.key === status),
  );

  const progress =
    status === "sent" && sentAt && now !== null
      ? Math.min(96, ((now - new Date(sentAt).getTime()) / ESTIMATED_DELIVERY_MS) * 100)
      : 0;

  return (
    <div>
      <div className="flex items-center">
        {STAGES.map((s, i) => (
          <Fragment key={s.key}>
            {i > 0 && (
              <div
                className="h-0.5 flex-1 transition-colors duration-700"
                style={{ background: i <= stageIndex ? accent : "#e7ddcd" }}
              />
            )}
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-base shadow-sm transition-all duration-500"
                style={{
                  background: i <= stageIndex ? accent : "#f1e9da",
                  color: i <= stageIndex ? "#fff" : "#b3a48c",
                  transform: i === stageIndex ? "scale(1.12)" : "scale(1)",
                  boxShadow: i === stageIndex ? `0 0 0 4px ${accent}33` : undefined,
                }}
              >
                {s.icon}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: i <= stageIndex ? "#3a2f22" : "#b3a48c" }}
              >
                {s.label}
              </span>
            </div>
          </Fragment>
        ))}
      </div>

      {status === "sent" && fulfillment === "delivery" && (
        <div className="mt-5">
          <div className="relative h-9 overflow-hidden rounded-full bg-[#f1e9da]">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${progress}%`, background: `${accent}33` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 text-xl transition-[left] duration-1000 ease-linear"
              style={{ left: `calc(${progress}% - 14px)` }}
            >
              🛵
            </div>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-[#8a7a63]">
            Курьер такси уже в пути — обычно доставка занимает около 30 минут
          </p>
        </div>
      )}
    </div>
  );
}
