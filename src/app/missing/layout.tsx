import { connection } from "next/server";
import { getConfig } from "@/server/config";
import LocaleLayout from "@/app/[locale]/layout";

// Root layout of the proxy's not-found target: the public frame in the default
// language, since the requested path names no usable language. Rendered per
// request, so the build needs no runtime configuration.
export default async function MissingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const locale = getConfig().SITE_DEFAULT_LANGUAGE;
  return (
    <LocaleLayout params={Promise.resolve({ locale })}>{children}</LocaleLayout>
  );
}
