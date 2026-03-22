"use server";

import { redirect } from "next/navigation";
import { appendPhotosToSession } from "@/lib/data-store";
import type { PhotoRole } from "@/lib/types";

const validRoles = new Set<PhotoRole>(["label", "location", "inside", "spread", "detail"]);

export async function attachPhotosToCurrentSession(formData: FormData) {
  const boxId = String(formData.get("boxId") ?? "").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const assetIds = formData
    .getAll("assetId")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!boxId || !sessionId) {
    throw new Error("boxId och sessionId måste anges.");
  }

  if (assetIds.length === 0) {
    redirect(`/boxes/${boxId}`);
  }

  await appendPhotosToSession({
    boxId,
    sessionId,
    photos: assetIds.map((assetId) => {
      const roleValue = String(formData.get(`role:${assetId}`) ?? "detail").trim() as PhotoRole;
      const capturedAt = String(formData.get(`capturedAt:${assetId}`) ?? "").trim();

      return {
        immichAssetId: assetId,
        photoRole: validRoles.has(roleValue) ? roleValue : "detail",
        capturedAt: capturedAt || undefined
      };
    })
  });

  redirect(`/boxes/${boxId}`);
}
