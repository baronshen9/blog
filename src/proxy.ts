import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie } from "@/app/admin/session-cookie";
import { getConfig } from "@/server/config";
import { languages } from "@/server/posts";

// Next.js root hook for two cases:
// - Signed-out visitors of admin pages go to the sign-in page. Only the
//   presence of a session cookie is checked; pages and actions validate it.
// - A public URL whose first segment is not a supported language (`/fr/x`) is
//   served by the default language's catch-all page, so it gets the framed
//   not-found page with a 404 instead of the framework's default page. The
//   rewrite drops the original path, which could otherwise name a real page
//   (`/posts/<slug>` would become `/en/posts/<slug>`).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (
      pathname !== "/admin/sign-in" &&
      !request.cookies.has(sessionCookie.name)
    ) {
      return NextResponse.redirect(new URL("/admin/sign-in", request.url));
    }
    return;
  }
  const first = pathname.split("/")[1] ?? "";
  if (first && !(languages as readonly string[]).includes(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${getConfig().SITE_DEFAULT_LANGUAGE}/unknown-language`;
    return NextResponse.rewrite(url);
  }
}

// Every other top-level route outside the languages must be excluded here.
export const config = { matcher: "/((?!_next/|healthz$|api/).*)" };
