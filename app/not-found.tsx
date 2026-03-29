import Link from "next/link";
import { createTranslator } from "@/lib/i18n";
import { readResolvedLanguageCatalog } from "@/lib/request-language";
import { readAppSettings } from "@/lib/settings";

export default async function NotFound() {
  const settings = await readAppSettings();
  const languageCatalog = await readResolvedLanguageCatalog(settings.appearance.language);
  const t = createTranslator(languageCatalog);

  return (
    <div className="panel">
      <h2>{t("notFound.title", "Sidan hittades inte")}</h2>
      <p>{t("notFound.body", "Kontrollera box-id eller gå tillbaka till översikten.")}</p>
      <Link className="button" href="/">
        {t("notFound.back", "Till översikten")}
      </Link>
    </div>
  );
}
