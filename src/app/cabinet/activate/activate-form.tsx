"use client";

import { useActionState } from "react";
import Link from "next/link";
import { activateInviteCode } from "@/lib/invite-code-actions";

export default function ActivateForm() {
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(
    activateInviteCode,
    { error: null },
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8 shadow-xl">
        <h1 className="mb-1 text-xl font-semibold text-neutral-50">Активация доступа</h1>
        <p className="mb-6 text-sm text-neutral-400">
          Введите код, который вам передали, и придумайте пароль для входа в кабинет.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-400">Код активации</label>
            <input
              name="code"
              required
              autoCapitalize="characters"
              placeholder="XXXXXXXX"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-center text-lg font-mono uppercase tracking-widest text-neutral-50 outline-none focus:border-amber-500"
            />
          </div>

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
            <label className="mb-1 block text-xs font-medium text-neutral-400">Придумайте пароль</label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-amber-500"
            />
          </div>

          {state.error && <p className="text-sm text-red-400">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {pending ? "Активируем..." : "Активировать"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Уже активировали доступ?{" "}
          <Link href="/cabinet/login" className="text-amber-400 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
