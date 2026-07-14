import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./global.css";
import { RootProvider } from "fumadocs-ui/provider";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://democraft.dev"),
  title: {
    default: "Democraft — Demos as code",
    template: "%s · Democraft",
  },
  description:
    "Create software demos as code. Playwright captures the browser, Remotion renders the video, one API for developers and AI agents.",
  applicationName: "Democraft",
  openGraph: {
    type: "website",
    siteName: "Democraft",
    title: "Democraft — Demos as code",
    description:
      "Playwright captures the browser, Remotion renders the video, one API for developers and AI agents.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Democraft — Demos as code",
    description:
      "Playwright captures the browser, Remotion renders the video, one API for developers and AI agents.",
  },
  alternates: {
    canonical: "/",
    languages: {
      en: "/docs/en",
      "pt-BR": "/docs/pt-BR",
    },
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="antialiased">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
