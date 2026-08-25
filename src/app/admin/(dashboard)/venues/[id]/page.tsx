import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VenueForm from "./venue-form";
import ImageUploader from "./image-uploader";
import OwnerAccess from "./owner-access";
import TelegramConnect from "./telegram-connect";
import { deleteVenue } from "../actions";
import { ConfirmButton } from "@/components/confirm-button";

export default async function VenueInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: venue }, { data: owners }, { data: codes }] = await Promise.all([
    supabase.from("venues").select("*").eq("id", id).single(),
    supabase.from("venue_users").select("id, email, created_at").eq("venue_id", id),
    supabase
      .from("venue_invite_codes")
      .select("id, code, used_at")
      .eq("venue_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!venue) notFound();

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-400">Логотип</p>
          <ImageUploader venueId={id} kind="logo" currentUrl={venue.logo_url} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-400">Обложка</p>
          <ImageUploader venueId={id} kind="cover" currentUrl={venue.cover_url} />
        </div>

        <OwnerAccess venueId={id} owners={owners ?? []} codes={codes ?? []} />
        <TelegramConnect
          venueId={id}
          connected={!!venue.telegram_chat_id}
          hasToken={!!venue.telegram_bot_token}
        />

        <form action={deleteVenue.bind(null, id)} className="pt-4">
          <ConfirmButton
            message={`Удалить заведение «${venue.name}» целиком? Это удалит все категории, блюда и заказы без возможности восстановления.`}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950"
          >
            Удалить заведение
          </ConfirmButton>
        </form>
      </div>

      <VenueForm venue={venue} />
    </div>
  );
}
