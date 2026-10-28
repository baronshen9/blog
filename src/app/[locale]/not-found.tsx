"use client";

import { useParams } from "next/navigation";
import type { Locale } from "@/messages";
import { NotFoundCard } from "./not-found-card";

// Rendered inside the public frame. Not-found pages receive no props, so the
// language comes from the URL, whose locale the proxy and layout have checked.
export default function NotFound() {
  const { locale } = useParams<{ locale: Locale }>();
  return <NotFoundCard locale={locale} />;
}
