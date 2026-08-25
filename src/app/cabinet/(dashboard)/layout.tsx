import { redirect } from "next/navigation";
import { LayoutGrid, Tags, UtensilsCrossed, QrCode, ClipboardList, Percent, Gift, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { logout } from "../login/actions";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/cabinet/login");

  const { data: ownerRow } = await supabase
    .from("venue_users")
    .select("venue_id, venues(name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!ownerRow) redirect("/cabinet/login");

  const venue = ownerRow.venues as unknown as { name: string; slug: string } | null;

  return (
    <DashboardShell
      brand={
        <>
          Menora <span className="text-amber-500">Cabinet</span>
        </>
      }
      subtitle={venue ? `${venue.name} · /${venue.slug}` : undefined}
      logoutAction={logout}
      navItems={[
        { href: "/cabinet/info", icon: <LayoutGrid size={16} />, label: "Инфо" },
        { href: "/cabinet/categories", icon: <Tags size={16} />, label: "Категории" },
        { href: "/cabinet/dishes", icon: <UtensilsCrossed size={16} />, label: "Блюда" },
        { href: "/cabinet/orders", icon: <ClipboardList size={16} />, label: "Заказы" },
        { href: "/cabinet/promo", icon: <Percent size={16} />, label: "Промокоды" },
        { href: "/cabinet/loyalty", icon: <Gift size={16} />, label: "Бонусы" },
        { href: "/cabinet/reviews", icon: <Star size={16} />, label: "Отзывы" },
        { href: "/cabinet/qr", icon: <QrCode size={16} />, label: "QR-код" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
