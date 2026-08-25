"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resizeToWebp } from "@/lib/image";

function revalidateDishes(venueId: string) {
  // cheap no-op if the path isn't currently cached — safe to call from both
  // the admin and the owner cabinet, which share these same server actions.
  revalidatePath(`/admin/venues/${venueId}/dishes`);
  revalidatePath("/admin");
  revalidatePath("/cabinet/dishes");
}

export async function createDish(
  venueId: string,
  basePath: string,
  _prevState: { error: string | null },
  formData: FormData,
) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");
  const price = Number(formData.get("price") ?? 0);

  if (!name) return { error: "Введите название блюда" };
  if (!categoryId) return { error: "Выберите категорию" };

  const supabase = await createClient();
  const { count } = await supabase
    .from("dishes")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId);

  const { data, error } = await supabase
    .from("dishes")
    .insert({
      venue_id: venueId,
      category_id: categoryId,
      name,
      price: Number.isFinite(price) ? price : 0,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidateDishes(venueId);
  redirect(`${basePath}/${data.id}`);
}

export async function updateDish(
  venueId: string,
  dishId: string,
  _prevState: { error: string | null; ok?: boolean },
  formData: FormData,
) {
  const supabase = await createClient();

  const price = Number(formData.get("price") ?? 0);
  const discountRaw = String(formData.get("discount_price") ?? "").trim();

  const { error } = await supabase
    .from("dishes")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      name_uz: String(formData.get("name_uz") ?? "") || null,
      description: String(formData.get("description") ?? "") || null,
      description_uz: String(formData.get("description_uz") ?? "") || null,
      category_id: String(formData.get("category_id") ?? ""),
      price: Number.isFinite(price) ? price : 0,
      discount_price: discountRaw ? Number(discountRaw) : null,
      is_available: formData.get("is_available") === "on",
      is_new: formData.get("is_new") === "on",
      is_popular: formData.get("is_popular") === "on",
    })
    .eq("id", dishId);

  if (error) return { error: error.message };

  revalidateDishes(venueId);
  return { error: null, ok: true };
}

export async function deleteDish(venueId: string, dishId: string, basePath: string) {
  const supabase = await createClient();
  await supabase.from("dishes").delete().eq("id", dishId);
  revalidateDishes(venueId);
  redirect(basePath);
}

export async function toggleDishFlag(
  venueId: string,
  dishId: string,
  field: "is_available" | "is_new" | "is_popular",
  value: boolean,
) {
  const supabase = await createClient();
  const update =
    field === "is_available"
      ? { is_available: value }
      : field === "is_new"
        ? { is_new: value }
        : { is_popular: value };
  await supabase.from("dishes").update(update).eq("id", dishId);
  revalidateDishes(venueId);
}

export async function uploadDishPhoto(venueId: string, dishId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "Файл не выбран" };
  if (!file.type.startsWith("image/")) return { error: "Файл должен быть изображением" };

  const webp = await resizeToWebp(file, { maxWidth: 800, maxHeight: 800 });

  const supabase = await createClient();
  const path = `dishes/${dishId}/photo.webp`;

  const { error: uploadError } = await supabase.storage
    .from("menora-media")
    .upload(path, webp, { upsert: true, contentType: "image/webp" });

  if (uploadError) return { error: uploadError.message };

  const { data: pub } = supabase.storage.from("menora-media").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("dishes")
    .update({ photo_url: `${pub.publicUrl}?v=${Date.now()}` })
    .eq("id", dishId);

  if (updateError) return { error: updateError.message };

  revalidateDishes(venueId);
  return { error: null };
}
