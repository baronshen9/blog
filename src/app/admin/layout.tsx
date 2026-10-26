import type { Metadata } from "next";
// The design tokens and base styles, also for the sign-in page.
import "@/ui";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Root layout of the admin, which is English only; public pages get their own
// root layout under [locale].
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
