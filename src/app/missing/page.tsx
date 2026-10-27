import { notFound } from "next/navigation";

// The proxy rewrites public URLs that name no page here (see src/proxy.ts).
export default function MissingPage(): never {
  notFound();
}
