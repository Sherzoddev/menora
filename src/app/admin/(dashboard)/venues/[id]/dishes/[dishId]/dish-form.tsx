"use client";

import { useActionState } from "react";
import { updateDish } from "../actions";
import type { Tables } from "@/lib/supabase/types";

export default function DishForm({
  venueId,
  dish,
  categories,
}: {
  venueId: string;
  dish: Tables<"dishes">;
  categories: { id: string; name: string }[];
}) {
  const action = updateDish.bind(null, venueId, dish.id);
  const [state, formAction, pending] = useActionState<{ error: string | null; ok?: boolean }, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Название (рус)">
        <input name="name" defaultValue={dish.name} required className="input" />
      </Field>
      <Field label="Nomi (uz)">
        <input name="name_uz" defaultValue={dish.name_uz ?? ""} className="input" />
      </Field>

      <Field label="Категория">
        <select name="category_id" defaultValue={dish.category_id} className="input">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Описание (рус)">
        <textarea name="description" defaultValue={dish.description ?? ""} rows={2} className="input" />
      </Field>
      <Field label="Tavsif (uz)">
        <textarea name="description_uz" defaultValue={dish.description_uz ?? ""} rows={2} className="input" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Цена">
          <input name="price" type="number" step="0.01" defaultValue={dish.price} required className="input" />
        </Field>
        <Field label="Цена со скидкой (необязательно)">
          <input name="discount_price" type="number" step="0.01" defaultValue={dish.discount_price ?? ""} className="input" />
        </Field>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input type="checkbox" name="is_available" defaultChecked={dish.is_available} />
          В наличии
        </label>
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input type="checkbox" name="is_new" defaultChecked={dish.is_new} />
          Новинка
        </label>
        <label className="flex items-center gap-1.5 text-sm text-neutral-300">
          <input type="checkbox" name="is_popular" defaultChecked={dish.is_popular} />
          Популярное
        </label>
      </div>

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
