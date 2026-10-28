import { getConfig } from "@/server/config";
import { NotFoundCard } from "@/app/[locale]/not-found-card";

// The proxy's target names no usable language, so the page is in the default
// language, like its frame (see layout.tsx).
export default function MissingNotFound() {
  return <NotFoundCard locale={getConfig().SITE_DEFAULT_LANGUAGE} />;
}
