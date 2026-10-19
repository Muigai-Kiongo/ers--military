import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Rajdhani, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jet",
  display: "swap",
});

export const metadata: Metadata = {
  title: "M-TERS — Military Tactical Emergency Response System",
  description:
    "Secure tactical emergency response: TCCC guidance, 9-line MEDEVAC, hazard reporting and a live command picture. AES-256 encrypted, offline-capable, night-optimized.",
};

export const viewport: Viewport = {
  themeColor: "#020806",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const modeBoot = `try{var m=localStorage.getItem('mters_mode');if(m==='amber'||m==='red'){document.documentElement.dataset.mode=m;}else{document.documentElement.dataset.mode='green';}}catch(e){document.documentElement.dataset.mode='green';}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-mode="green" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: modeBoot }} />
      </head>
      <body
        className={`${rajdhani.variable} ${inter.variable} ${jetbrains.variable} bg-bg0 font-body text-ink antialiased`}
      >
        {children}
        <div className="noise" aria-hidden />
        <div className="scanlines" aria-hidden />
        <div className="vignette" aria-hidden />
      </body>
    </html>
  );
}
