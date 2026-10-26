import { getConfig } from "@/server/config";
import { AdminFrame } from "@/ui";
import { signOutAction } from "@/app/admin/actions";

// The frame of the signed-in admin pages; the sign-in page stays outside it.
// Each page checks access itself.
export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminFrame siteName={getConfig().SITE_NAME} signOutAction={signOutAction}>
      {children}
    </AdminFrame>
  );
}
