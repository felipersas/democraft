import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Schibsted_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./global.css";

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://democraft.dev"),
  title: "Democraft — Demos as code",
  description:
    "Create software demos as code. Playwright captures the browser, Remotion renders the video, one API for developers and AI agents.",
  applicationName: "Democraft",
  icons: {
    icon: "/brand/democraft-mark-dark.png",
    shortcut: "/brand/democraft-mark-dark.png",
  },
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
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
