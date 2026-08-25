import { redirect } from "next/navigation";
import { LayoutGrid, Tags, UtensilsCrossed, QrCode, ClipboardList, Percent, Gift, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { VenueSwitcher } from "@/components/venue-switcher";
import { getOwnerVenueId, getOwnerVenues } from "@/lib/cabinet";
import { logout } from "../login/actions";
import { switchVenue } from "../venue-switcher-actions";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/cabinet/login");

  const [venueId, venues] = await Promise.all([getOwnerVenueId(), getOwnerVenues()]);
  const venue = venues.find((v) => v.id === venueId) ?? null;

  return (
    <DashboardShell
      brand={
        <>
          Menora <span className="text-amber-500">Cabinet</span>
        </>
      }
      subtitle={venue ? `${venue.name} · /${venue.slug}` : undefined}
      venueSwitcher={<VenueSwitcher venues={venues} activeVenueId={venueId} switchAction={switchVenue} />}
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
