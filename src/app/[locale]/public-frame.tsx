"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SiteFrame } from "@/ui";
import { languageHrefs } from "./language-hrefs";

// The public frame with the language switch pointing at the current page's
// equivalent in each language. It follows client-side navigation, which does
// not render the layout again.
export function PublicFrame(
  props: Omit<React.ComponentProps<typeof SiteFrame>, "languageHrefs">,
) {
  const hrefs = languageHrefs(usePathname(), useSearchParams());
  return <SiteFrame {...props} languageHrefs={hrefs} />;
}
