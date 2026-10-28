"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, use, useEffect, useState } from "react";
import type { Language } from "@/server/posts";
import { SiteFrame } from "@/ui";
import { languageHrefs } from "./language-hrefs";

// Where the language switch leads in one language from the page at `pathname`,
// instead of what the URL alone tells.
type SwitchTarget = { pathname: string; language: Language; href: string };

const SwitchTargetContext = createContext<
  (target: SwitchTarget | null) => void
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
  const [target, setTarget] = useState<SwitchTarget | null>(null);
  if (target?.pathname === pathname) hrefs[target.language] = target.href;
  return (
    <SwitchTargetContext value={setTarget}>
      <SiteFrame {...props} languageHrefs={hrefs}>
        {children}
      </SiteFrame>
    </SwitchTargetContext>
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
  const setTarget = use(SwitchTargetContext);
  const pathname = usePathname();
  useEffect(() => {
    setTarget({ pathname, language, href });
    return () => setTarget(null);
  }, [setTarget, pathname, language, href]);
  return null;
}
