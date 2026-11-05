import Link from "next/link";
import { CircleUserRound, Menu } from "lucide-react";
import LanguageSelector from "./LanguageSelector";
import SidebarNav from "./SidebarNav";
import ThemeToggle from './ThemeToggle';

export default function MobileHeader({lang='en'}:{lang?:'th'|'en'}) {
  return (
    <header className="mobile-header">
      <Link href="/" className="mobile-brand">
        <img src="/logo.png" alt="Thailand Humanoid Atlas Logo" className="mobile-logo-img" />
        <span className="mobile-title">THAILAND HUMANOID ATLAS</span>
      </Link>
      <div className="mobile-header-actions"><ThemeToggle lang={lang}/><Link href="/profile" className="mobile-profile" aria-label={lang==='th' ? 'บัญชีของคุณ' : 'Your account'}>
        <CircleUserRound size={22} className="profile-icon" />
      </Link>
        <details className="mobile-all-nav">
          <summary aria-label={lang === 'th' ? 'เมนูทั้งหมด' : 'All pages'}><Menu size={22} aria-hidden="true" /></summary>
          <div className="mobile-all-nav-content">
            <SidebarNav currentLang={lang} />
            <LanguageSelector currentLang={lang} />
          </div>
        </details>
      </div>
    </header>
  );
}
