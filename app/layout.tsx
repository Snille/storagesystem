import type { Metadata } from "next";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAvailableAlbums } from "@/lib/immich-albums";
import { fetchAlbumAssets } from "@/lib/immich";
import { readAppSettings } from "@/lib/settings";
import { getShelfSystemCount } from "@/lib/shelf-map";
import { ThemeController } from "@/app/theme-controller";

const inlineGlobalCss = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

export const metadata: Metadata = {
  title: "Hyllsystem",
  description: "Inventarieapp kopplad till Immich och JSON."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await readAppSettings();
  const [assets, data, albums] = await Promise.all([
    fetchAlbumAssets(),
    readInventoryData(),
    fetchAvailableAlbums({
      baseUrl: settings.immich.baseUrl,
      accessMode: settings.immich.accessMode,
      apiKey: settings.immich.apiKey,
      shareKey: settings.immich.shareKey,
      currentAlbumId: settings.immich.albumId
    }).catch(() => [])
  ]);
  const currentSessionIds = new Set([...getCurrentSessionByBox(data).values()].map((session) => session.sessionId));
  const mappedAssetIds = new Set(
    data.photos
      .filter((photo) => currentSessionIds.has(photo.sessionId))
      .map((photo) => photo.immichAssetId)
  );
  const inboxCount = assets.filter((asset) => !mappedAssetIds.has(asset.id)).length;
  const albumLabel =
    albums.find((album) => album.id === settings.immich.albumId)?.label ||
    settings.immich.accountLabel ||
    "Album";
  const shelfSystemCount = getShelfSystemCount(data);

  return (
    <html
      lang="sv"
      data-theme-mode={settings.appearance.theme}
      data-theme-resolved={
        settings.appearance.theme === "auto"
          ? "auto"
          : settings.appearance.theme === "dark"
            ? "dark"
            : "light"
      }
      data-font-family={settings.appearance.fontFamily}
      data-reduce-motion={settings.appearance.reduceMotion ? "true" : "false"}
      style={{ ["--font-base-size" as string]: `${settings.appearance.fontSizePt}pt` }}
      suppressHydrationWarning
    >
      <head>
        <style dangerouslySetInnerHTML={{ __html: inlineGlobalCss }} />
      </head>
      <body>
        <ThemeController appearance={settings.appearance} />
        <main>
          <nav className="topnav">
            <Link href="/">Översikt</Link>
            <Link href="/hyllsystem" className="nav-with-count">
              <span>Hyllsystem</span>
              <span className="nav-count" aria-label={`${shelfSystemCount} platsenheter`}>
                {shelfSystemCount}
              </span>
            </Link>
            <Link href="/inbox" className="nav-with-count">
              <span>{albumLabel}</span>
              <span className="nav-count" aria-label={`${inboxCount} bilder i inkorgen`}>
                {inboxCount}
              </span>
            </Link>
            <Link href="/boxes/new">Ny låda / inventering</Link>
            <Link href="/labels">Etiketter</Link>
            <Link href="/settings">Inställningar</Link>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
