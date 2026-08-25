"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm({
  redirectTo,
  justActivated,
}: {
  redirectTo: string;
  justActivated?: boolean;
}) {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(login, {
    error: null,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-semibold text-neutral-50">Menora — кабинет владельца</h1>
        <p className="mb-6 text-sm text-neutral-400">Вход для владельцев заведений</p>

        {justActivated && (
          <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            Доступ активирован! Войдите с email и паролем, которые вы только что задали.
          </p>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Email</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Пароль</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-amber-500"
            />
          </div>

          {state.error && <p className="text-sm text-red-400">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {pending ? "Входим..." : "Войти"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Есть код активации?{" "}
          <Link href="/cabinet/activate" className="text-amber-400 hover:underline">
            Активировать доступ
          </Link>
        </p>
      </div>
    </div>
  );
}
