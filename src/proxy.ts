import { NextResponse, type NextRequest } from "next/server";
import { sessionCookie } from "@/app/admin/session-cookie";

// Sends signed-out visitors of admin pages to the sign-in page. It checks only
// that a session cookie is present; pages and actions validate it.
export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname !== "/admin/sign-in" &&
    !request.cookies.has(sessionCookie.name)
  ) {
    return NextResponse.redirect(new URL("/admin/sign-in", request.url));
  }
}

export const config = { matcher: "/admin/:path*" };
