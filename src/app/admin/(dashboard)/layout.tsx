import { LayoutGrid, Store, BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { logout } from "../login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      brand={
        <>
          Menora <span className="text-amber-500">Admin</span>
        </>
      }
      logoutAction={logout}
      navItems={[
        { href: "/admin", icon: <LayoutGrid size={16} />, label: "Дашборд" },
        { href: "/admin/venues", icon: <Store size={16} />, label: "Заведения" },
        { href: "/admin/analytics", icon: <BarChart3 size={16} />, label: "Аналитика" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
