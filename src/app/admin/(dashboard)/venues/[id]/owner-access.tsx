"use client";

import { useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";
import { revokeOwner } from "./owner-actions";
import { createInviteCode, deleteInviteCode } from "@/lib/invite-code-actions";

type Owner = { id: string; email: string; created_at: string };
type InviteCode = { id: string; code: string; used_at: string | null };

export default function OwnerAccess({
  venueId,
  owners,
  codes,
}: {
  venueId: string;
  owners: Owner[];
  codes: InviteCode[];
}) {
  const [pending, startTransition] = useTransition();
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const unusedCodes = codes.filter((c) => !c.used_at);

  function handleGenerate() {
    startTransition(async () => {
      const { code } = await createInviteCode(venueId);
      setJustCreated(code);
    });
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="mb-3 text-sm font-medium">Доступ владельца</p>

      {owners.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Активные владельцы</p>
          {owners.map((o) => (
            <div key={o.id} className="flex items-center justify-between text-xs text-neutral-300">
              <span>{o.email}</span>
              <form action={revokeOwner.bind(null, venueId, o.id)}>
                <button className="text-neutral-500 hover:text-red-400">Отозвать</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {unusedCodes.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-neutral-500">Неиспользованные коды</p>
          {unusedCodes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
              <code className="rounded bg-neutral-800 px-2 py-1 font-mono tracking-widest text-amber-400">
                {c.code}
              </code>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(c.code)}
                  className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200"
                >
                  {copied === c.code ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <form action={deleteInviteCode.bind(null, venueId, c.id)}>
                  <button className="text-neutral-500 hover:text-red-400">Удалить</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={pending}
        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:border-amber-500 disabled:opacity-60"
      >
        {pending ? "Создаём..." : "Сгенерировать код активации"}
      </button>

      {justCreated && (
        <p className="mt-2 text-xs text-neutral-400">
          Код <code className="text-amber-400">{justCreated}</code> — передайте его владельцу. Он введёт его на
          странице <code>/cabinet/activate</code> вместе со своим email и паролем.
        </p>
      )}
    </div>
  );
}
