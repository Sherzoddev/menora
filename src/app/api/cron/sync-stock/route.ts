import { NextResponse } from "next/server";
import { syncVeloraStock } from "@/lib/velora-actions";

// Опрос остатков в Velora по расписанию — товар закончился → out_of_stock,
// его тут же скрывает меню Меноры; появился приход → снова видно. Velora
// сама не уведомляет об изменениях остатка, поэтому это именно опрос, а не
// мгновенная реакция.
//
// Триггерится либо Vercel Cron (vercel.json — но на Hobby-плане это раз в
// сутки, не раз в 5 минут), либо любым внешним планировщиком (cron-job.org,
// GitHub Actions и т.п.), дёргающим этот URL с интервалом. Секрет —
// в query-параметре, а не только в заголовке, потому что внешние
// планировщики часто не дают задать заголовки.
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const auth = request.headers.get("authorization");
    const provided = url.searchParams.get("secret") ?? auth?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await syncVeloraStock();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
}
