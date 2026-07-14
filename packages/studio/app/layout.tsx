import type { Metadata } from "next";
import { StudioProvider } from "@/lib/studio-context";
import { startFileWatcher } from "@/lib/file-watcher";
import "./globals.css";

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
      <body className="bg-[var(--color-bg)] text-[var(--color-fg)]">
        <StudioProvider>{children}</StudioProvider>
      </body>
    </html>
  );
}
