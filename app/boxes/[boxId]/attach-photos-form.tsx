"use client";

import { useMemo, useState } from "react";
import { attachPhotosToCurrentSession } from "@/app/boxes/[boxId]/actions";
import { ImageLightboxButton } from "@/app/components/image-lightbox-button";
import { presentPhotoRole } from "@/lib/photo-role-presentation";
import type { ImmichAsset, PhotoRole } from "@/lib/types";

type AttachPhotosFormProps = {
  boxId: string;
  sessionId: string;
  assets: ImmichAsset[];
  thumbnailUrls: Record<string, string>;
  originalUrls: Record<string, string>;
  locale: string;
  ui: Record<string, string>;
};

const roleOptions: PhotoRole[] = ["label", "location", "inside", "spread", "detail"];

export function AttachPhotosForm({ boxId, sessionId, assets, thumbnailUrls, originalUrls, locale, ui }: AttachPhotosFormProps) {
  const t = (key: string, fallback: string, values?: Record<string, string | number>) => {
    const template = ui[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? `{${token}}`));
  };
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, PhotoRole>>({});

  const selectedCount = selectedIds.length;
  const hasAssets = assets.length > 0;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleAsset(assetId: string) {
    setSelectedIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  function setRole(assetId: string, role: PhotoRole) {
    setRoles((current) => ({ ...current, [assetId]: role }));
  }

  return (
    <form action={attachPhotosToCurrentSession} className="shell">
      <input type="hidden" name="boxId" value={boxId} />
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="action-row">
        <button type="submit" disabled={selectedCount === 0}>
          {t("addSelectedImages", "Lägg till markerade bilder")}
        </button>
        <span className="muted">{t("selectedCount", "{count} valda bilder", { count: selectedCount })}</span>
      </div>

      {hasAssets ? (
        <div className="photo-grid">
          {[...assets].reverse().map((asset) => {
            const selected = selectedSet.has(asset.id);
            const currentRole = roles[asset.id] ?? "detail";

            return (
              <article className={`photo-card selectable-photo${selected ? " selected" : ""}`} key={asset.id}>
                <button
                  type="button"
                  className="select-toggle"
                  onClick={() => toggleAsset(asset.id)}
                  aria-pressed={selected}
                >
                  {selected ? t("selected", "Vald") : t("select", "Välj")}
                </button>
                <input type="hidden" name={`capturedAt:${asset.id}`} value={asset.fileCreatedAt} />
                {selected ? <input type="hidden" name="assetId" value={asset.id} /> : null}
                <ImageLightboxButton
                  alt={asset.originalFileName}
                  thumbnailUrl={thumbnailUrls[asset.id]}
                  originalUrl={originalUrls[asset.id]}
                  overlayTitle={asset.originalFileName}
                  overlayMeta={new Date(asset.fileCreatedAt).toLocaleString(locale)}
                />
                <div className="body">
                  <strong>{asset.originalFileName}</strong>
                  <p className="muted" style={{ marginTop: 6 }}>
                    {new Date(asset.fileCreatedAt).toLocaleString(locale)}
                  </p>
                  <label className="inline-field">
                    {t("role", "Bildroll")}
                    <select
                      name={`role:${asset.id}`}
                      value={currentRole}
                      onChange={(event) => setRole(asset.id, event.target.value as PhotoRole)}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {presentPhotoRole(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty">{t("noUnassignedImages", "Det finns inga okopplade bilder kvar att lägga till just nu.")}</div>
      )}
    </form>
  );
}
