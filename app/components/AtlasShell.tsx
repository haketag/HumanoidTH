"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "../home.module.css";

export default function AtlasShell({
  homeHeader,
  consoleChrome,
  consoleFooter,
  children,
}: {
  homeHeader: ReactNode;
  consoleChrome: ReactNode;
  consoleFooter: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <div className={styles.home}>{homeHeader}{children}</div>;
  }

  return (
    <div className="app-shell">
      {consoleChrome}
      <main className="main">{children}</main>
      {consoleFooter}
    </div>
  );
}
