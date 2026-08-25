"use client";

import { useActionState } from "react";
import { createDish } from "../actions";

export default function NewDishForm({
  venueId,
  categories,
  basePath,
}: {
  venueId: string;
  categories: { id: string; name: string }[];
  basePath: string;
}) {
  const action = createDish.bind(null, venueId, basePath);
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Название">
        <input name="name" required className="input" placeholder="Чикен бургер" />
      </Field>

      <Field label="Категория">
        <select name="category_id" required className="input">
          <option value="">Выберите категорию</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Цена (сум)">
        <input name="price" type="number" step="0.01" required className="input" placeholder="35000" />
      </Field>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {pending ? "Создаём..." : "Создать и редактировать"}
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
