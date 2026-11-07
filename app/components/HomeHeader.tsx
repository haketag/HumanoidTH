"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import LanguageSelector from "./LanguageSelector";
import ThemeToggle from "./ThemeToggle";
import SidebarNav from "./SidebarNav";
import styles from "../home.module.css";

export default function HomeHeader({ lang, isAdmin }: { lang: "en" | "th"; isAdmin: boolean }) {
  const thai = lang === "th";
  const pathname = usePathname();
  const primaryLinks = [
    { href: "/#overview", route: "/", label: thai ? "ภาพรวม" : "Overview" },
    { href: "/robots", route: "/robots", label: thai ? "หุ่นยนต์" : "Robots" },
    { href: "/research-assistant", route: "/research-assistant", label: thai ? "ผู้ช่วยวิจัย" : "Research Assistant" },
    { href: "/companies", route: "/companies", label: thai ? "บริษัทและองค์กร" : "Companies" },
  ];

  return (
    <header className={styles.header}>
      <a className={styles.skipLink} href="#main-content">{thai ? "ข้ามไปยังเนื้อหา" : "Skip to content"}</a>
      <Link href="/" className={styles.brand}>
        <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M16 2 26 6l4 11-5 10-9 3-10-4L2 16 7 6Z" />
          <path d="m16 2 6 10 8 5-13 6-1 7-5-12L2 16l20-4 3 15-14-9L7 6l10 17L26 6" />
        </svg>
        <span>HUMANOIDTH</span>
      </Link>
      <nav className={styles.headerNav} aria-label={thai ? "เมนูหลัก" : "Primary navigation"}>
        <div className={styles.primaryLinks}>
          {primaryLinks.map(({ href, route, label }) => (
            <Link key={href} href={href} aria-current={pathname === route || pathname?.startsWith(`${route}/`) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <details key={pathname} className={styles.menu}>
          <summary>{thai ? "เมนู" : "Menu"} <ChevronDown size={14} aria-hidden="true" /></summary>
          <div className={styles.menuPanel}>
            <SidebarNav currentLang={lang} isAdmin={isAdmin} />
          </div>
        </details>
        <div className={styles.settings}>
          <div className={styles.language}><LanguageSelector currentLang={lang} /></div>
          <div className={styles.theme}><ThemeToggle lang={lang} /></div>
        </div>
      </nav>
    </header>
  );
}
