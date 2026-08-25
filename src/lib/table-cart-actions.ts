"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Same reasoning as callWaiter/createOrder: guests have no Supabase session,
// so writes go through the service-role client. The increment happens
// inside adjust_table_cart_item() (SECURITY DEFINER, see migration) so two
// guests tapping "+" on the same dish at the same instant both land — a
// naive read-qty-then-write-qty here would let one overwrite the other.
export async function adjustTableCartItem(
  venueId: string,
  table: string,
  dish: { dishId: string; name: string; price: number; currency: string },
  delta: number,
) {
  const supabase = createAdminClient();
  await supabase.rpc("adjust_table_cart_item", {
    p_venue_id: venueId,
    p_table_number: table,
    p_dish_id: dish.dishId,
    p_dish_name: dish.name,
    p_price: dish.price,
    p_currency: dish.currency,
    p_delta: delta,
  });
}

export async function clearTableCart(venueId: string, table: string) {
  const supabase = createAdminClient();
  await supabase.from("table_carts").delete().eq("venue_id", venueId).eq("table_number", table);
}
