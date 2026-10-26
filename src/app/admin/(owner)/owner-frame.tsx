"use client";

import { usePathname } from "next/navigation";
import { AdminFrame } from "@/ui";

// The admin frame with the section of the current page marked; editing a
// post belongs to Posts.
export function OwnerFrame(
  props: Omit<React.ComponentProps<typeof AdminFrame>, "current">,
) {
  const current = usePathname() === "/admin/posts/new" ? "new-post" : "posts";
  return <AdminFrame {...props} current={current} />;
}
