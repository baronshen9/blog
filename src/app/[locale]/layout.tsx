import { getConfig } from "@/server/config";
import { localeParam } from "./locale-param";
import { PublicFrame } from "./public-frame";

// Root layout of the public site, whose interface language is the locale
// segment.
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = localeParam((await params).locale);
  return (
    <html lang={locale}>
      <body>
        <PublicFrame siteName={getConfig().SITE_NAME} locale={locale}>
          {children}
        </PublicFrame>
      </body>
    </html>
  );
}
