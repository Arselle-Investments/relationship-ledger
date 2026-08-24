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
  matcher: ["/((?!login|api/auth|api/dev-login|_next/static|_next/image|favicon.ico).*)"],
  // Session lookups go through Prisma/Postgres, which needs the Node.js runtime (not Edge).
  runtime: "nodejs",
};
