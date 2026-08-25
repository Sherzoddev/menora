"use client";

import { useState } from "react";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Пн" },
  { key: "tue", label: "Вт" },
  { key: "wed", label: "Ср" },
  { key: "thu", label: "Чт" },
  { key: "fri", label: "Пт" },
  { key: "sat", label: "Сб" },
  { key: "sun", label: "Вс" },
];

const DEFAULT_RANGE = "09:00-22:00";

export default function WorkingHoursEditor({ initial }: { initial: Record<string, string> }) {
  const [hours, setHours] = useState<Record<string, string>>(initial ?? {});

  function splitRange(range: string | undefined) {
    if (!range) return { start: "09:00", end: "22:00" };
    const [start, end] = range.split("-").map((t) => t.trim());
    return { start: start || "09:00", end: end || "22:00" };
  }

  function toggleDay(key: string, open: boolean) {
    setHours((prev) => {
      const next = { ...prev };
      if (open) {
        next[key] = DEFAULT_RANGE;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  function setTime(key: string, part: "start" | "end", value: string) {
    setHours((prev) => {
      const { start, end } = splitRange(prev[key]);
      const range = part === "start" ? `${value}-${end}` : `${start}-${value}`;
      return { ...prev, [key]: range };
    });
  }

  return (
    <div className="space-y-1.5">
      {DAYS.map((d) => {
        const isOpen = d.key in hours;
        const { start, end } = splitRange(hours[d.key]);
        return (
          <div key={d.key} className="flex items-center gap-2 text-xs">
            <label className="flex w-20 shrink-0 items-center gap-1.5 text-neutral-300">
              <input
                type="checkbox"
                checked={isOpen}
                onChange={(e) => toggleDay(d.key, e.target.checked)}
              />
              {d.label}
            </label>
            {isOpen ? (
              <>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setTime(d.key, "start", e.target.value)}
                  className="input w-24"
                />
                <span className="text-neutral-500">—</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setTime(d.key, "end", e.target.value)}
                  className="input w-24"
                />
              </>
            ) : (
              <span className="text-neutral-600">выходной</span>
            )}
          </div>
        );
      })}

      <input type="hidden" name="working_hours" value={JSON.stringify(hours)} />
    </div>
  );
}
