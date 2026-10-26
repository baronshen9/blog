import type { Metadata } from "next";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>This page does not exist or is no longer published.</p>
    </main>
  );
}
