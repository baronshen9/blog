import { redirect } from "next/navigation";
import { getConfig } from "@/server/config";

export const dynamic = "force-dynamic";

// `/` leads to the home page of the default language.
export function GET(): never {
  redirect(`/${getConfig().SITE_DEFAULT_LANGUAGE}`);
}
