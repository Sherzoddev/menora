import { notFound } from "next/navigation";
import { getOwnerVenueId } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/server";
import VenueForm from "@/app/admin/(dashboard)/venues/[id]/venue-form";
import ImageUploader from "@/app/admin/(dashboard)/venues/[id]/image-uploader";
import TelegramConnect from "@/app/admin/(dashboard)/venues/[id]/telegram-connect";

export default async function CabinetInfoPage() {
  const venueId = await getOwnerVenueId();
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("*").eq("id", venueId).single();

  if (!venue) notFound();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Информация о заведении</h1>
      <div className="grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-400">Логотип</p>
            <ImageUploader venueId={venueId} kind="logo" currentUrl={venue.logo_url} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-neutral-400">Обложка</p>
            <ImageUploader venueId={venueId} kind="cover" currentUrl={venue.cover_url} />
          </div>

          <TelegramConnect
            venueId={venueId}
            connected={!!venue.telegram_chat_id}
            hasToken={!!venue.telegram_bot_token}
          />
        </div>

        <VenueForm venue={venue} disableSlug />
      </div>
    </div>
  );
}
