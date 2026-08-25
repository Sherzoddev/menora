"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { setVenueBotToken, disconnectVenueBot } from "@/lib/telegram-actions";
import { broadcastToCustomers } from "@/lib/broadcast-actions";

export default function TelegramConnect({
  venueId,
  connected,
  hasToken,
}: {
  venueId: string;
  connected: boolean;
  hasToken: boolean;
}) {
  const action = setVenueBotToken.bind(null, venueId);
  const [state, formAction, pending] = useActionState<
    { error: string | null; ok?: boolean; botUsername?: string },
    FormData
  >(action, { error: null });
  const [editing, setEditing] = useState(!hasToken);

  const broadcastAction = broadcastToCustomers.bind(null, venueId);
  const [broadcastState, broadcastFormAction, broadcastPending] = useActionState<
    { error: string | null; ok?: boolean; count?: number },
    FormData
  >(broadcastAction, { error: null });

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="mb-1 text-sm font-medium">Telegram-уведомления о заказах</p>

      {!editing && hasToken ? (
        <>
          {connected ? (
            <p className="text-xs text-emerald-400">✓ Бот подключён — новые заказы приходят в Telegram</p>
          ) : (
            <p className="text-xs text-amber-400">
              Токен сохранён, но никто ещё не нажал «Старт» в боте — откройте своего бота в Telegram и нажмите Старт.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs text-neutral-400 underline hover:text-neutral-200">
              Заменить бота
            </button>
            <form action={disconnectVenueBot.bind(null, venueId)}>
              <button className="text-xs text-red-400 underline hover:text-red-300">Отключить</button>
            </form>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-neutral-500">
            У каждого заведения свой Telegram-бот. Создайте его бесплатно через{" "}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-amber-400 underline">
              @BotFather
            </a>{" "}
            (команда /newbot) и вставьте сюда токен вида <code>123456789:AAH...</code>.
          </p>
          <form action={formAction} className="flex gap-2">
            <input
              name="bot_token"
              placeholder="Токен бота"
              required
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:border-amber-500 disabled:opacity-60"
            >
              {pending ? "..." : "Сохранить"}
            </button>
          </form>
          {state.error && <p className="mt-2 text-xs text-red-400">{state.error}</p>}
          {state.ok && (
            <p className="mt-2 text-xs text-emerald-400">
              Готово! Откройте{" "}
              <a
                href={`https://t.me/${state.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                <Send size={11} /> @{state.botUsername}
              </a>{" "}
              и нажмите «Старт», чтобы начать получать заказы.
            </p>
          )}
        </>
      )}

      {hasToken && (
        <div className="mt-4 border-t border-neutral-800 pt-4">
          <p className="mb-1 text-sm font-medium">Рассылка клиентам бота</p>
          <p className="mb-2 text-xs text-neutral-500">
            Сообщение уйдёт всем, кто хотя бы раз открывал бота этого заведения (акция, новое блюдо и т.п.).
          </p>
          <form action={broadcastFormAction} className="space-y-2">
            <textarea
              name="message"
              rows={3}
              required
              placeholder="Сегодня скидка 20% на все бургеры!"
              className="input w-full resize-none"
            />
            <button
              type="submit"
              disabled={broadcastPending}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:border-amber-500 disabled:opacity-60"
            >
              {broadcastPending ? "Отправляем..." : "Отправить всем клиентам"}
            </button>
          </form>
          {broadcastState.error && <p className="mt-2 text-xs text-red-400">{broadcastState.error}</p>}
          {broadcastState.ok && (
            <p className="mt-2 text-xs text-emerald-400">Отправлено {broadcastState.count} клиентам ✓</p>
          )}
        </div>
      )}
    </div>
  );
}
