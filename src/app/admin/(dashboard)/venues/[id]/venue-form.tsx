"use client";

import { useActionState } from "react";
import { updateVenue } from "../actions";
import type { Tables } from "@/lib/supabase/types";
import WorkingHoursEditor from "@/components/working-hours-editor";

const LANGUAGES = [
  { code: "ru", label: "Русский" },
  { code: "uz", label: "Ўзбекча" },
];

export default function VenueForm({
  venue,
  disableSlug,
}: {
  venue: Tables<"venues">;
  disableSlug?: boolean;
}) {
  const action = updateVenue.bind(null, venue.id);
  const [state, formAction, pending] = useActionState<{ error: string | null; ok?: boolean }, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Название">
        <input name="name" defaultValue={venue.name} required className="input" />
      </Field>

      <Field label="Slug">
        {disableSlug ? (
          <>
            <input defaultValue={venue.slug} disabled className="input opacity-60" />
            <p className="mt-1 text-[11px] text-neutral-500">
              Slug меняет только администратор сервиса — от него зависят уже напечатанные QR-коды.
            </p>
          </>
        ) : (
          <input name="slug" defaultValue={venue.slug} required className="input" />
        )}
      </Field>

      <Field label="Описание">
        <textarea name="description" defaultValue={venue.description ?? ""} rows={2} className="input" />
      </Field>

      <Field label="Адрес">
        <input name="address" defaultValue={venue.address ?? ""} className="input" />
      </Field>

      <Field label="Телефон">
        <input name="phone" defaultValue={venue.phone ?? ""} className="input" />
      </Field>

      <Field label="Instagram">
        <input name="instagram" defaultValue={venue.instagram ?? ""} className="input" placeholder="https://instagram.com/..." />
      </Field>

      <Field label="Telegram">
        <input name="telegram" defaultValue={venue.telegram ?? ""} className="input" placeholder="https://t.me/..." />
      </Field>

      <Field label="Режим работы">
        <WorkingHoursEditor initial={(venue.working_hours as Record<string, string>) ?? {}} />
      </Field>

      <Field label="Бонусные баллы — % от суммы заказа">
        <input
          type="number"
          name="loyalty_percent"
          min={0}
          max={100}
          step={0.1}
          defaultValue={venue.loyalty_percent}
          className="input"
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          Гость получит столько % от суммы заказа бонусными баллами (1 балл = 1 сум). 0 — программа лояльности выключена.
        </p>
      </Field>

      <Field label="Velora — интеграция кассы">
        <div className="grid grid-cols-2 gap-3">
          <input
            name="velora_venue_id"
            defaultValue={venue.velora_venue_id ?? ""}
            placeholder="venue_id в Velora"
            className="input"
          />
          <input
            name="velora_token"
            defaultValue={venue.velora_token ?? ""}
            placeholder="токен заведения"
            className="input"
          />
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Если оба поля заполнены, каждый оформленный заказ автоматически открывает счёт в кассе Velora.
          Пусто — интеграция выключена.
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Основной цвет">
          <input type="color" name="primary_color" defaultValue={venue.primary_color ?? "#111111"} className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800" />
        </Field>
        <Field label="Акцентный цвет">
          <input type="color" name="accent_color" defaultValue={venue.accent_color ?? "#c9a227"} className="h-9 w-full rounded-lg border border-neutral-700 bg-neutral-800" />
        </Field>
      </div>

      <Field label="Языки меню">
        <div className="flex gap-4">
          {LANGUAGES.map((l) => (
            <label key={l.code} className="flex items-center gap-1.5 text-sm text-neutral-300">
              <input
                type="checkbox"
                name="languages"
                value={l.code}
                defaultChecked={venue.languages?.includes(l.code) ?? l.code === "ru"}
              />
              {l.label}
            </label>
          ))}
        </div>
      </Field>

      <label className="flex items-center gap-1.5 text-sm text-neutral-300">
        <input type="checkbox" name="is_active" defaultChecked={venue.is_active} />
        Заведение активно (видно по ссылке)
      </label>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-400">Сохранено</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? "Сохраняем..." : "Сохранить"}
      </button>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #404040;
          background: #262626;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #f5f5f5;
          outline: none;
        }
        .input:focus {
          border-color: #f59e0b;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-400">{label}</label>
      {children}
    </div>
  );
}
