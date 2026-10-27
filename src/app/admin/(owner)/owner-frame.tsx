"use client";

import { usePathname } from "next/navigation";
import { AdminFrame } from "@/ui";

type Section = React.ComponentProps<typeof AdminFrame>["current"];

// Pages whose section is not Posts; editing a post belongs to Posts.
const sections: Record<string, Section> = {
  "/admin/posts/new": "new-post",
  "/admin/trash": "trash",
};

// The admin frame with the section of the current page marked.
export function OwnerFrame(
  props: Omit<React.ComponentProps<typeof AdminFrame>, "current">,
) {
  const current = sections[usePathname()] ?? "posts";
  return <AdminFrame {...props} current={current} />;
}
