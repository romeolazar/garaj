import Link from "next/link";
import { BarChart3, Bell, LogOut, SlidersHorizontal, UsersRound, Warehouse } from "lucide-react";
import { AppLogo } from "@/components/ui/app-logo";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { activeAlerts } from "@/lib/garage";
import { loadGarage } from "@/lib/garage-data";

type Section = "dashboard" | "alerts" | "reports" | "drivers" | "settings";

export async function AppShell({ children, active }: { children: React.ReactNode; active?: Section }) {
  const { user, isAdmin, vehicles, settings, dismissed } = await loadGarage();
  const alerts = activeAlerts(vehicles, settings, dismissed).length;

  const items: Array<[Section, string, string, React.ReactNode, boolean]> = [
    ["dashboard", "Garaj", "/", <Warehouse key="h" className="i" />, true],
    ["alerts", "Alerte", "/alerts", <Bell key="b" className="i" />, true],
    ["reports", "Rapoarte", "/reports", <BarChart3 key="r" className="i" />, true],
    ["drivers", "Șoferi", "/users", <UsersRound key="u" className="i" />, isAdmin],
    ["settings", "Setări", "/settings", <SlidersHorizontal key="s" className="i" />, isAdmin]
  ];

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/" title="Garaj" aria-label="Garaj">
          <span className="brand-mark"><AppLogo id="brand" /></span>
        </Link>
        <nav className="topnav">
          {items.filter((item) => item[4]).map(([id, label, href, icon]) => (
            <Link key={id} href={href} className={active === id ? "active" : ""}>
              {icon}
              {label}
              {id === "alerts" && alerts ? <span className="badge">{alerts}</span> : null}
            </Link>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link className="user-chip" href="/profile" title={`${user.email} · Profilul meu`}>
            <Avatar name={user} imageUrl={user.profileImageUrl} />
            <span>{user.firstName}</span>
          </Link>
          <ThemeToggle />
          <Link href="/api/auth/signout" className="icon-btn" title="Deconectare"><LogOut className="i" /></Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
