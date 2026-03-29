import type { Metadata } from "next";
import type { ReactNode } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { getCurrentSessionByBox, readInventoryData } from "@/lib/data-store";
import { fetchAvailableAlbums } from "@/lib/immich-albums";
import { getUnmappedInboxAssets } from "@/lib/album-assets";
import { fetchAlbumDetails } from "@/lib/immich";
import { createTranslator } from "@/lib/i18n";
import { readResolvedLanguageCatalog } from "@/lib/request-language";
import { readAppSettings } from "@/lib/settings";
import { getShelfSystemCount } from "@/lib/shelf-map";
import { ThemeController } from "@/app/theme-controller";
import type { AvailableAlbum } from "@/lib/types";

const inlineGlobalCss = readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");

export const metadata: Metadata = {
  title: "Lagersystem",
  description: "Inventarieapp kopplad till ett bildalbum och JSON."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await readAppSettings();
  const [album, data, albums, languageCatalog] = await Promise.all([
    fetchAlbumDetails().catch(() => ({ id: "", assets: [], albumThumbnailAssetId: "", albumName: "" })),
    readInventoryData(),
    fetchAvailableAlbums({
      provider: settings.immich.provider,
      baseUrl: settings.immich.baseUrl,
      accessMode: settings.immich.accessMode,
      apiKey: settings.immich.apiKey,
      shareKey: settings.immich.shareKey,
      currentAlbumId: settings.immich.albumId
    }).catch(() => [] as AvailableAlbum[]),
    readResolvedLanguageCatalog(settings.appearance.language)
  ]);
  const t = createTranslator(languageCatalog);
  const currentSessionIds = new Set([...getCurrentSessionByBox(data).values()].map((session) => session.sessionId));
  const mappedAssetIds = new Set<string>(
    data.photos
      .filter((photo) => currentSessionIds.has(photo.sessionId))
      .map((photo) => photo.immichAssetId)
  );
  const inboxCount = getUnmappedInboxAssets(album, mappedAssetIds).length;
  const albumLabel =
    albums.find((album) => album.id === settings.immich.albumId)?.label ||
    settings.immich.accountLabel ||
    "Album";
  const shelfSystemCount = getShelfSystemCount(data);

  return (
    <html
      lang={languageCatalog._meta.htmlLang}
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
            <Link href="/">{t("nav.overview", "Översikt")}</Link>
            <Link href="/hyllsystem" className="nav-with-count">
              <span>{t("nav.locations", "Lagerplats")}</span>
              <span className="nav-count" aria-label={t("nav.locationUnitsAria", "{count} platsenheter", { count: shelfSystemCount })}>
                {shelfSystemCount}
              </span>
            </Link>
            <Link href="/inbox" className="nav-with-count">
              <span>{albumLabel}</span>
              <span className="nav-count" aria-label={t("nav.inboxCountAria", "{count} bilder i inkorgen", { count: inboxCount })}>
                {inboxCount}
              </span>
            </Link>
            <Link href="/boxes/new">{t("nav.newBox", "Ny låda / inventering")}</Link>
            <Link href="/labels">{t("nav.labels", "Etiketter")}</Link>
            <Link href="/settings">{t("nav.settings", "Inställningar")}</Link>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
