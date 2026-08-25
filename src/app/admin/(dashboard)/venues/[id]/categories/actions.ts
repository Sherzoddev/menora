"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resizeToWebp } from "@/lib/image";

export async function createCategory(venueId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venueId);

  await supabase.from("categories").insert({
    venue_id: venueId,
    name,
    name_uz: String(formData.get("name_uz") ?? "") || null,
    sort_order: count ?? 0,
  });

  revalidatePath(`/admin/venues/${venueId}/categories`);
}

export async function updateCategory(venueId: string, categoryId: string, formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("categories")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      name_uz: String(formData.get("name_uz") ?? "") || null,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", categoryId);

  revalidatePath(`/admin/venues/${venueId}/categories`);
}

export async function deleteCategory(venueId: string, categoryId: string) {
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", categoryId);
  revalidatePath(`/admin/venues/${venueId}/categories`);
}

export async function uploadCategoryImage(venueId: string, categoryId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Файл не выбран" };
  if (!file.type.startsWith("image/")) return { error: "Файл должен быть изображением" };

  const webp = await resizeToWebp(file, { maxWidth: 1200, maxHeight: 600 });

  const supabase = await createClient();
  const path = `venues/${venueId}/categories/${categoryId}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("menora-media")
    .upload(path, webp, { upsert: true, contentType: "image/webp" });

  if (uploadError) return { error: uploadError.message };

  const { data: pub } = supabase.storage.from("menora-media").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("categories")
    .update({ image_url: `${pub.publicUrl}?v=${Date.now()}` })
    .eq("id", categoryId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/admin/venues/${venueId}/categories`);
  revalidatePath("/cabinet/categories");
  return { error: null };
}

export async function moveCategory(venueId: string, categoryId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, sort_order")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  if (!categories) return;

  const index = categories.findIndex((c) => c.id === categoryId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= categories.length) return;

  const a = categories[index];
  const b = categories[swapIndex];

  await Promise.all([
    supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);

  revalidatePath(`/admin/venues/${venueId}/categories`);
}
