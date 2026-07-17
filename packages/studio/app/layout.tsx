import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { StudioProvider } from "@/lib/studio-context";
import { startFileWatcher } from "@/lib/file-watcher";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Democraft Studio",
  description: "Local preview and render surface for Democraft",
};

startFileWatcher().catch(() => {
  /* watcher is best-effort */
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={schibsted.variable}>
        <StudioProvider>{children}</StudioProvider>
      </body>
    </html>
  );
}
