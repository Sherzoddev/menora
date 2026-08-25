"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { resizeToWebp } from "@/lib/image";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createVenue(_prevState: { error: string | null }, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);

  if (!name) return { error: "Введите название заведения" };
  if (!slug) return { error: "Некорректный slug" };
  if (isReservedSlug(slug)) return { error: `Slug "${slug}" зарезервирован системой, выберите другой` };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({ name, slug })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: `Slug "${slug}" уже занят` };
    return { error: error.message };
  }

  revalidatePath("/admin");
  redirect(`/admin/venues/${data.id}`);
}

export async function updateVenue(venueId: string, _prevState: { error: string | null; ok?: boolean }, formData: FormData) {
  const supabase = await createClient();

  const languages = formData.getAll("languages").map(String);
  const workingHoursRaw = String(formData.get("working_hours") ?? "").trim();

  let workingHours: Record<string, string> = {};
  if (workingHoursRaw) {
    try {
      workingHours = JSON.parse(workingHoursRaw);
    } catch {
      return { error: "Режим работы должен быть в формате JSON, напр. {\"mon\":\"09:00-22:00\"}" };
    }
  }

  // the slug input is rendered `disabled` for venue owners, so browsers omit it
  // from the submitted FormData entirely — in that case keep the existing slug
  // (the actual write is still guarded server-side by the protect_venue_slug trigger).
  const slugRaw = formData.get("slug");
  let slug: string;
  if (slugRaw === null) {
    const { data: current } = await supabase.from("venues").select("slug").eq("id", venueId).single();
    slug = current?.slug ?? "";
  } else {
    slug = slugify(String(slugRaw));
    if (!slug) return { error: "Некорректный slug" };
    if (isReservedSlug(slug)) return { error: `Slug "${slug}" зарезервирован системой, выберите другой` };
  }

  const loyaltyPercentRaw = Number(formData.get("loyalty_percent"));
  const loyaltyPercent = Number.isFinite(loyaltyPercentRaw)
    ? Math.min(100, Math.max(0, loyaltyPercentRaw))
    : 2;

  const { error } = await supabase
    .from("venues")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      slug,
      description: String(formData.get("description") ?? "") || null,
      address: String(formData.get("address") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      instagram: String(formData.get("instagram") ?? "") || null,
      telegram: String(formData.get("telegram") ?? "") || null,
      primary_color: String(formData.get("primary_color") ?? "") || "#111111",
      accent_color: String(formData.get("accent_color") ?? "") || "#c9a227",
      languages: languages.length ? languages : ["ru"],
      working_hours: workingHours,
      loyalty_percent: loyaltyPercent,
      velora_venue_id: String(formData.get("velora_venue_id") ?? "").trim() || null,
      velora_token: String(formData.get("velora_token") ?? "").trim() || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", venueId);

  if (error) {
    if (error.code === "23505") return { error: `Slug "${slug}" уже занят` };
    return { error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/venues/${venueId}`);
  return { error: null, ok: true };
}

export async function deleteVenue(venueId: string) {
  const supabase = await createClient();
  await supabase.from("venues").delete().eq("id", venueId);
  revalidatePath("/admin");
  redirect("/admin");
}

const VENUE_IMAGE_LIMITS = {
  logo: { maxWidth: 400, maxHeight: 400 },
  cover: { maxWidth: 1600, maxHeight: 900 },
} as const;

export async function uploadVenueImage(venueId: string, kind: "logo" | "cover", formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Файл не выбран" };
  if (!file.type.startsWith("image/")) return { error: "Файл должен быть изображением" };

  const webp = await resizeToWebp(file, VENUE_IMAGE_LIMITS[kind]);

  const supabase = await createClient();
  const path = `venues/${venueId}/${kind}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("menora-media")
    .upload(path, webp, { upsert: true, contentType: "image/webp" });

  if (uploadError) return { error: uploadError.message };

  const { data: pub } = supabase.storage.from("menora-media").getPublicUrl(path);
  const imageUrl = `${pub.publicUrl}?v=${Date.now()}`;
  const update = kind === "logo" ? { logo_url: imageUrl } : { cover_url: imageUrl };

  const { error: updateError } = await supabase.from("venues").update(update).eq("id", venueId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath("/admin");
  return { error: null };
}
