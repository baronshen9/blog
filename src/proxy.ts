import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie } from "@/app/admin/session-cookie";
import type { ErrorResponse } from "@/contract";
import { languages } from "@/server/posts";

// Next.js root hook for three cases:
// - A path with a malformed percent-encoding (`/en/posts/%E0`) names no page.
//   Next.js fails to decode such a path into route params and answers with a
//   bare 500, so it gets the framed not-found page instead (see `missing`),
//   or, under `/api/`, the API's JSON error.
// - Signed-out visitors of admin pages go to the sign-in page. Only the
//   presence of a session cookie is checked; pages and actions validate it.
// - A public URL whose first segment is not a supported language (`/fr/x`)
//   gets the framed not-found page too.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!decodes(pathname)) {
    return pathname.startsWith("/api/") ? malformedApiPath() : missing(request);
  }
  if (pathname.startsWith("/api/")) return;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (
      pathname !== "/admin/sign-in" &&
      !request.cookies.has(sessionCookie.name)
    ) {
      return NextResponse.redirect(new URL("/admin/sign-in", request.url));
    }
    return;
  }
  if (pathname.startsWith("/media/")) return;
  const first = pathname.split("/")[1] ?? "";
  if (first && !(languages as readonly string[]).includes(first)) {
    return missing(request);
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

// Serves the not-found page of the static `/missing` route, in the default
// language's frame. Next.js matches the rewritten route's pattern against the
// original path, so a target with a dynamic segment would hit the same decode
// failure. The rewrite also drops the original path, which could otherwise
// name a real page (`/posts/<slug>` would become `/en/posts/<slug>`).
function missing(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/missing";
  return NextResponse.rewrite(url);
}

function malformedApiPath() {
  const body: ErrorResponse = {
    error: {
      code: "VALIDATION",
      message: "The address holds a malformed percent-encoding.",
    },
  };
  return NextResponse.json(body, { status: 400 });
}

// Every other top-level route outside the languages must be excluded here or
// handled above. API requests reach the proxy only when their path holds a
// percent sign: running the proxy makes Next.js buffer the request body, which
// the image upload must avoid.
export const config = {
  matcher: ["/((?!_next/|healthz$|api/|missing$).*)", "/api/(.*%.*)"],
};
