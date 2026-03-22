import type { PhotoRole } from "@/lib/types";

const roleLabels: Record<PhotoRole, string> = {
  label: "Etikett",
  location: "Plats",
  inside: "Inuti",
  spread: "Utplockat",
  detail: "Detalj"
};

export function presentPhotoRole(role: PhotoRole | string) {
  return roleLabels[role as PhotoRole] ?? role;
}

