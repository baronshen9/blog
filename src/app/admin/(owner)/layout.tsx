import { connection } from "next/server";
import { getConfig } from "@/server/config";
import { signOutAction } from "@/app/admin/actions";
import { OwnerFrame } from "@/app/admin/(owner)/owner-frame";

// The frame of the signed-in admin pages; the sign-in page stays outside it.
// Each page checks access itself. Rendered per request, so the build needs no
// runtime configuration.
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <OwnerFrame siteName={getConfig().SITE_NAME} signOutAction={signOutAction}>
      {children}
    </OwnerFrame>
  );
}
