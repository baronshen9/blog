import type { Metadata } from "next";
import { Card } from "@/ui";

export const metadata: Metadata = { title: "Not found" };

// Rendered inside the public frame. Not-found pages receive no params, so the
// way back is `/`, which leads to the home page of the default language.
export default function NotFound() {
  return (
    <main>
      <Card title="Page not found" backHref="/" backLabel="All posts">
        <p>This page does not exist or is no longer published.</p>
      </Card>
    </main>
  );
}
