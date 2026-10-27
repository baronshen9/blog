import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie } from "@/app/admin/session-cookie";
import { languages } from "@/server/posts";

// Next.js root hook for two cases:
// - Signed-out visitors of admin pages go to the sign-in page. Only the
//   presence of a session cookie is checked; pages and actions validate it.
// - A public URL whose first segment is not a supported language (`/fr/x`), or
//   whose path holds a malformed percent-encoding (`/en/posts/%E0`), is served
//   by the static `/missing` route, so it gets the framed not-found page with a
//   404 instead of the framework's default page. Next.js matches the rewritten
//   route's pattern against the original path and answers a param it cannot
//   decode with a bare 500, so the target must have no dynamic segment. The
//   rewrite also drops the original path, which could otherwise name a real
//   page (`/posts/<slug>` would become `/en/posts/<slug>`).
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
  if (
    (first && !(languages as readonly string[]).includes(first)) ||
    !decodes(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/missing";
    return NextResponse.rewrite(url);
  }
}

function decodes(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}

// Every other top-level route outside the languages must be excluded here.
export const config = {
  matcher: "/((?!_next/|healthz$|api/|media/|missing$).*)",
};
