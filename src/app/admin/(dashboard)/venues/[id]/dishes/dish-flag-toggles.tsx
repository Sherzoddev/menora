"use client";

import { useTransition } from "react";
import { toggleDishFlag } from "./actions";
import type { Tables } from "@/lib/supabase/types";

const FLAGS: { field: "is_new" | "is_popular" | "is_available"; label: string }[] = [
  { field: "is_new", label: "Новинка" },
  { field: "is_popular", label: "Популярное" },
  { field: "is_available", label: "В наличии" },
];

export default function DishFlagToggles({ venueId, dish }: { venueId: string; dish: Tables<"dishes"> }) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 flex-col gap-1">
      {FLAGS.map((f) => (
        <label key={f.field} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
          <input
            type="checkbox"
            defaultChecked={dish[f.field]}
            onChange={(e) =>
              startTransition(() => {
                toggleDishFlag(venueId, dish.id, f.field, e.target.checked);
              })
            }
          />
          {f.label}
        </label>
      ))}
    </div>
  );
}
