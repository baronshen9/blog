import { connection } from "next/server";
import { countPendingComments } from "@/server/comments";
import { getConfig } from "@/server/config";
import { signOutAction } from "@/app/admin/actions";
import { requireOwner } from "@/app/admin/session";
import { OwnerFrame } from "@/app/admin/(owner)/owner-frame";

// The frame of the signed-in admin pages; the sign-in page stays outside it.
// Each page checks access itself; the layout checks it too, since it shows the
// number of pending comments. Rendered per request, so the build needs no
// runtime configuration. Layouts do not render again when the owner moves
// between admin pages, so the count updates on a page load or after an
// action that refreshes the page.
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  await requireOwner();
  return (
    <OwnerFrame
      siteName={getConfig().SITE_NAME}
      pendingComments={await countPendingComments()}
      signOutAction={signOutAction}
    >
      {children}
    </OwnerFrame>
  );
}
