"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useState } from "react";
import type { Language } from "@/server/posts";
import { SiteFrame } from "@/ui";
import { languageHrefs } from "./language-hrefs";

// Where the language switch leads in each language from the page at
// `pathname`, instead of what the URL alone tells.
type SwitchTargets = Partial<
  Record<Language, { pathname: string; href: string }>
>;

const SwitchTargetsContext = createContext<
  React.Dispatch<React.SetStateAction<SwitchTargets>>
>(() => {});

// The public frame with the language switch pointing at the current page's
// equivalent in each language. It follows client-side navigation, which does
// not render the layout again.
export function PublicFrame({
  children,
  ...props
}: Omit<React.ComponentProps<typeof SiteFrame>, "languageHrefs">) {
  const pathname = usePathname();
  const hrefs = languageHrefs(pathname, useSearchParams());
  const [targets, setTargets] = useState<SwitchTargets>({});
  for (const [language, target] of Object.entries(targets)) {
    if (target?.pathname === pathname)
      hrefs[language as Language] = target.href;
  }
  return (
    <SwitchTargetsContext value={setTargets}>
      <SiteFrame {...props} languageHrefs={hrefs}>
        {children}
      </SiteFrame>
    </SwitchTargetsContext>
  );
}

// Points the language switch at `href` for `language` while the page that
// renders this is shown, such as a post at its published translation. The
// switch learns it once the page runs in the browser; until then it leads
// where the URL alone tells.
export function SwitchTo({
  language,
  href,
}: {
  language: Language;
  href: string;
}) {
  const setTargets = use(SwitchTargetsContext);
  const pathname = usePathname();
  useEffect(() => {
    setTargets((targets) => ({ ...targets, [language]: { pathname, href } }));
    return () =>
      setTargets((targets) => ({ ...targets, [language]: undefined }));
  }, [setTargets, pathname, language, href]);
  return null;
}
