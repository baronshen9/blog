import { notFound } from "next/navigation";
import { z } from "zod";
import { languages, type Language } from "@/server/posts";

// The interface language of a public page, from its locale segment
// (the proxy sends unknown languages elsewhere); an unknown one is not found.
export function localeParam(segment: string): Language {
  const locale = z.enum(languages).safeParse(segment);
  if (!locale.success) notFound();
  return locale.data;
}
