import type { Metadata, Viewport } from "next";
import { Geist_Mono, Tajawal } from "next/font/google";
import Script from "next/script";
import { AppProviders } from "@/components/app-providers";
import { SkipToContent } from "@/components/public/skip-to-content";
import { BRAND_NAME_AR } from "@/lib/public/brand";
import { HOME_DESCRIPTION, HOME_TITLE, SITE_ORIGIN, TITLE_TEMPLATE } from "@/lib/public/seo";
import "./globals.css";

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  applicationName: BRAND_NAME_AR,
  title: {
    default: HOME_TITLE,
    template: TITLE_TEMPLATE,
  },
  description: HOME_DESCRIPTION,
  icons: {
    icon: [
      { url: "/brand/wanasatna-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/wanasatna-favicon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/brand/wanasatna-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "ar",
    siteName: BRAND_NAME_AR,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  other: {
    "google-adsense-account": "ca-pub-6489048987333106",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${tajawal.variable} ${geistMono.variable} h-full antialiased`}
    >
      <Script
        id="google-adsense"
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6489048987333106"
        crossOrigin="anonymous"
        strategy="beforeInteractive"
      />
      <body className="relative flex min-h-full flex-col overflow-x-hidden">
        <div aria-hidden className="wanas-site-bg-pattern" />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <SkipToContent />
          <AppProviders>{children}</AppProviders>
        </div>
      </body>
    </html>
  );
}
