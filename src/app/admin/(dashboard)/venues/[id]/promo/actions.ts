"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function revalidatePromo(venueId: string) {
  revalidatePath(`/admin/venues/${venueId}/promo`);
  revalidatePath("/cabinet/promo");
}

export async function createPromoCode(venueId: string, formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const discountType = String(formData.get("discount_type") ?? "percent") === "fixed" ? "fixed" : "percent";
  const discountValue = Number(formData.get("discount_value") ?? 0);
  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();

  if (!code || !Number.isFinite(discountValue) || discountValue <= 0) return;

  const supabase = await createClient();
  await supabase.from("promo_codes").insert({
    venue_id: venueId,
    code,
    discount_type: discountType,
    discount_value: discountType === "percent" ? Math.min(discountValue, 100) : discountValue,
    max_uses: maxUsesRaw ? Number(maxUsesRaw) : null,
  });

  revalidatePromo(venueId);
}

export async function togglePromoCode(venueId: string, id: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from("promo_codes").update({ is_active: isActive }).eq("id", id);
  revalidatePromo(venueId);
}

export async function deletePromoCode(venueId: string, id: string) {
  const supabase = await createClient();
  await supabase.from("promo_codes").delete().eq("id", id);
  revalidatePromo(venueId);
}
