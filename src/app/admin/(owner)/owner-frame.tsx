"use client";

import { usePathname } from "next/navigation";
import { AdminFrame } from "@/ui";

type Section = React.ComponentProps<typeof AdminFrame>["current"];

// The section of each admin page other than Posts, which also holds editing.
const sections: Record<string, Section> = {
  "/admin/posts/new": "new-post",
  "/admin/comments": "comments",
  "/admin/trash": "trash",
  "/admin/tokens": "tokens",
};

// The admin frame with the section of the current page marked.
export function OwnerFrame(
  props: Omit<React.ComponentProps<typeof AdminFrame>, "current">,
) {
  const current = sections[usePathname()] ?? "posts";
  return <AdminFrame {...props} current={current} />;
}
