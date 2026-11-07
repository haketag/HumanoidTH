"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "../home.module.css";

export default function AtlasShell({
  header,
  consoleFooter,
  children,
}: {
  header: ReactNode;
  consoleFooter: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isChat = pathname === "/research-assistant";
  const pageClass = isHome ? styles.home : isChat ? styles.chatLayout : "";

  return (
    <div className={`${styles.shell} ${pageClass}`}>
      {header}
      {isHome ? children : (
        <main id="main-content" tabIndex={-1} className={isChat ? "pet-chat-route" : "main"}>
          {children}
        </main>
      )}
      {!isHome && !isChat && consoleFooter}
    </div>
  );
}
