import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "./components/ThemeToggle";

const jetBrains = JetBrains_Mono({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const ibmSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmMono = IBM_Plex_Mono({
  variable: "--font-mono-custom",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Research Lab AI",
  description: "Autonomous research pipeline foundation powered by TokenRouter.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${jetBrains.variable} ${ibmSans.variable} ${ibmMono.variable}`}
    >
      <head>
        {/* Restore saved theme before paint to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('erevna-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
      </head>
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
