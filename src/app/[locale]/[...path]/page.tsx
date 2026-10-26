import { notFound } from "next/navigation";

// Any other path under a language shows that language's not-found page inside
// the public frame instead of the framework's default page.
export default function UnknownPage(): never {
  notFound();
}
