import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  if (!req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = {
  // Protect everything except the sign-in page, its API routes, and static assets.
  // Each alternative is anchored to a path-segment boundary (/ or end-of-string) so a
  // future route merely starting with one of these strings (e.g. /login-history) doesn't
  // silently inherit the exclusion.
  matcher: ["/((?!login(?:/|$)|api/auth(?:/|$)|api/dev-login(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$).*)"],
  // Session lookups go through Prisma/Postgres, which needs the Node.js runtime (not Edge).
  runtime: "nodejs",
};
