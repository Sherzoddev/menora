"use client";

import { useActionState } from "react";
import { createVenue } from "../actions";

export default function NewVenuePage() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(createVenue, {
    error: null,
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">Новое заведение</h1>

      <form action={formAction} className="space-y-4">
        <Field label="Название">
          <input name="name" required className="input" placeholder="RIVERA" />
        </Field>

        <Field label="Slug (латиницей, необязательно — сгенерируется из названия)">
          <input name="slug" className="input" placeholder="rivera" />
        </Field>

        {state.error && <p className="text-sm text-red-400">{state.error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {pending ? "Создаём..." : "Создать заведение"}
        </button>
      </form>

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
    </div>
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
