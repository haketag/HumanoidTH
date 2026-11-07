import type { Metadata } from "next";
import { cookies } from "next/headers";
import AtlasShell from "./components/AtlasShell";
import HomeHeader from "./components/HomeHeader";
import DataPullFab from "./components/DataPullFab";
import { defaultSeoDescription, getSiteUrl, siteName } from "@/lib/seo";
import { verifyAdminSessionToken } from "@/lib/admin-session";
import "./globals.css";
import { FavoritesProvider } from './components/FavoritesProvider';
import { ThemeProvider } from './components/ThemeToggle';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: siteName,
  title: {
    default: siteName,
    template: `%s | ${siteName}`
  },
  description: defaultSeoDescription,
  keywords: [
    "Thailand humanoid robots",
    "humanoid robotics Thailand",
    "social robots Thailand",
    "service robots Thailand",
    "robotics research database",
    "robot model registry",
    "robotics ecosystem map"
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: siteName,
    description: defaultSeoDescription,
    locale: "en_US",
    alternateLocale: ["th_TH"],
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 1200,
        alt: `${siteName} logo`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: defaultSeoDescription,
    images: ["/logo.png"]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" }
    ],
    shortcut: "/logo.png",
    apple: "/logo.png"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const theme = cookieStore.get('theme')?.value === 'dark' ? 'dark' : 'light';
  const isAdmin = await verifyAdminSessionToken(cookieStore.get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET);
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    description: defaultSeoDescription,
    inLanguage: ["en", "th"],
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: `${siteUrl}/logo.png`
    },
    mainEntity: {
      "@type": "Dataset",
      name: `${siteName} robotics corpus`,
      description: defaultSeoDescription,
      url: siteUrl,
      keywords: [
        "humanoid robotics",
        "Thailand robotics",
        "social robots",
        "service robots",
        "robotics research"
      ],
      inLanguage: ["en", "th"]
    }
  };

  return (
    <html lang={lang} data-theme={theme}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <ThemeProvider initialTheme={theme}>
        <FavoritesProvider>
          <AtlasShell
            header={<HomeHeader lang={lang} isAdmin={isAdmin} />}
            consoleFooter={isAdmin && <DataPullFab />}
          >
            {children}
          </AtlasShell>
        </FavoritesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
