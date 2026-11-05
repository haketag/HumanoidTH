"use client";

import NavigationLink from './NavigationLink';
import { Star } from 'lucide-react';
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  CircleUserRound,
  Database,
  Inbox,
  LayoutDashboard,
  Network,
  Newspaper,
  Send,
  Settings2,
  UsersRound,
  Home,
  MapPinned,
  Package
} from "lucide-react";
import { getTranslation } from "@/lib/translations";

interface SidebarNavProps {
  currentLang?: "en" | "th";
}

export default function SidebarNav({ currentLang = "en" }: SidebarNavProps) {
  const pathname = usePathname() || "/";
  const t = getTranslation(currentLang);

  const navGroups = [
    [
      { href: "/", label: t.overview, icon: Home },      { href: "/robots", label: t.robots, icon: Bot },      { href: "/match", label: "Humanoid Match", icon: Bot },      { href: '/favorites', label: currentLang === 'th' ? 'รายการที่ถูกใจ' : 'Favorites', icon: Star },    ],
    [
      { href: "/dashboard", label: t.dashboard, icon: LayoutDashboard },      { href: "/network", label: t.network, icon: Network },      { href: '/companies', label: currentLang === 'th' ? 'บริษัทและองค์กร' : 'Companies', icon: Network },      { href: '/company', label: currentLang === 'th' ? 'พอร์ทัลบริษัท' : 'Company Portal', icon: UsersRound },      { href: "/map", label: t.map, icon: MapPinned },      { href: "/perspectives", label: t.perspectives, icon: Newspaper },      { href: "/inventory", label: t.inventory, icon: Package },      { href: "/contributions", label: t.contributors, icon: UsersRound },      { href: "/analytics", label: t.analytics, icon: BarChart3 },    ],
    [
      { href: "/database", label: t.database, icon: Database },      { href: "/data-pulls", label: t.dataPulls, icon: Inbox },      { href: "/submit-data", label: t.submit, icon: Send },      { href: "/admin", label: t.admin, icon: Settings2 },      { href: "/profile", label: t.profile, icon: CircleUserRound }    ],
  ];

  return (
    <nav className="nav" aria-label={currentLang === 'th' ? 'เมนูหลัก' : 'Primary'}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest('a')) {
          event.currentTarget.closest('details')?.removeAttribute('open');
        }
      }}
    >
      {navGroups.map((items) => (
        <div className="nav-group" key={items[0].href}>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <NavigationLink
                key={item.href}
                href={item.href}
                className={isActive ? "active" : ""}
                current={isActive}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </NavigationLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
