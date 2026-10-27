import { notFound } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/server/config";
import { languages } from "@/server/posts";
import { SiteFrame } from "@/ui";

// Root layout of the public site. The locale segment is validated here; the
// interface text stays English until the language switch arrives in M5.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = z.enum(languages).safeParse((await params).locale);
  if (!locale.success) notFound();
  return (
    <html lang={locale.data}>
      <body>
        <SiteFrame
          siteName={getConfig().SITE_NAME}
          homeHref={`/${locale.data}`}
          searchHref={`/${locale.data}/search`}
        >
          {children}
        </SiteFrame>
      </body>
    </html>
  );
}
