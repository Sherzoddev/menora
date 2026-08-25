"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { adjustTableCartItem, clearTableCart } from "@/lib/table-cart-actions";

export type CartItem = {
  dishId: string;
  name: string;
  price: number;
  currency: string;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  shared: boolean;
  addItem: (item: Omit<CartItem, "qty">) => void;
  removeItem: (dishId: string) => void;
  setQty: (dishId: string, qty: number) => void;
  qtyOf: (dishId: string) => number;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

// A table-scoped guest gets a shared, real-time cart instead of a private
// one — everyone at the table sees the same list and can add/adjust it, so
// a group can order together without passing one phone around. Delivery/
// pickup guests (no table) keep the original private localStorage cart.
export function CartProvider({
  venueId,
  table,
  children,
}: {
  venueId: string;
  table?: string;
  children: React.ReactNode;
}) {
  const shared = !!table;
  const storageKey = `menora-cart-${venueId}`;
  const [localItems, setLocalItems] = useState<CartItem[]>([]);
  const [sharedItems, setSharedItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (shared) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLocalItems(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  useEffect(() => {
    if (shared || !hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(localItems));
  }, [localItems, hydrated, shared, storageKey]);

  useEffect(() => {
    if (!shared || !table) return;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("table_carts")
        .select("dish_id, dish_name, price, currency, quantity")
        .eq("venue_id", venueId)
        .eq("table_number", table as string);
      if (cancelled || !data) return;
      setSharedItems(data.map((r) => ({ dishId: r.dish_id, name: r.dish_name, price: r.price, currency: r.currency, qty: r.quantity })));
    }

    load();
    // Any change on the venue's table carts triggers a full reload rather
    // than a payload-diff merge — table_carts per table is at most a
    // handful of rows, so simplicity wins over shaving one round trip.
    const channel = supabase
      .channel(`table-cart-${venueId}-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_carts", filter: `venue_id=eq.${venueId}` }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [shared, venueId, table]);

  const items = shared ? sharedItems : localItems;

  const addItem: CartContextValue["addItem"] = (item) => {
    if (shared && table) {
      adjustTableCartItem(venueId, table, { ...item }, 1);
      return;
    }
    setLocalItems((prev) => {
      const existing = prev.find((i) => i.dishId === item.dishId);
      if (existing) {
        return prev.map((i) => (i.dishId === item.dishId ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeItem: CartContextValue["removeItem"] = (dishId) => {
    if (shared && table) {
      const existing = sharedItems.find((i) => i.dishId === dishId);
      if (existing) adjustTableCartItem(venueId, table, existing, -existing.qty);
      return;
    }
    setLocalItems((prev) => prev.filter((i) => i.dishId !== dishId));
  };

  const setQty: CartContextValue["setQty"] = (dishId, qty) => {
    if (shared && table) {
      const existing = sharedItems.find((i) => i.dishId === dishId);
      if (!existing) return;
      const delta = qty - existing.qty;
      if (delta !== 0) adjustTableCartItem(venueId, table, existing, delta);
      return;
    }
    setLocalItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.dishId !== dishId);
      return prev.map((i) => (i.dishId === dishId ? { ...i, qty } : i));
    });
  };

  const qtyOf: CartContextValue["qtyOf"] = (dishId) => items.find((i) => i.dishId === dishId)?.qty ?? 0;

  const clear = () => {
    if (shared && table) {
      clearTableCart(venueId, table);
      return;
    }
    setLocalItems([]);
  };

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const total = useMemo(() => items.reduce((sum, i) => sum + i.qty * i.price, 0), [items]);

  return (
    <CartContext.Provider value={{ items, count, total, shared, addItem, removeItem, setQty, qtyOf, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
