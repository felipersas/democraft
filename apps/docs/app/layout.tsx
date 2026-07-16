import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { Schibsted_Grotesk } from "next/font/google";

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://docs.democraft.dev"),
  title: {
    default: "Democraft Documentation",
    template: "%s · Democraft",
  },
  description:
    "Documentation for authoring, capturing, and rendering Democraft demos.",
  applicationName: "Democraft Documentation",
  icons: {
    icon: "/brand/democraft-mark-dark.png",
    shortcut: "/brand/democraft-mark-dark.png",
  },
  alternates: {
    canonical: "/en/docs/introduction",
    languages: {
      en: "/en/docs",
      "pt-BR": "/pt-BR/docs",
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={sans.variable}
    >
      <body className="antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
