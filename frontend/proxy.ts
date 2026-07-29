import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const pathname = url.pathname;

  // Intercept Better Auth's error endpoint
  if (pathname === "/api/auth/error") {
    const error = url.searchParams.get("error");
    const description = url.searchParams.get("error_description");

    const redirectUrl = new URL("/auth/error", url);
    if (error) {
      redirectUrl.searchParams.set("error", error);
    }
    if (description) {
      redirectUrl.searchParams.set("error_description", description);
    }
    return NextResponse.redirect(redirectUrl);
  }
  // Admin routes - require admin role
  if (pathname.startsWith("/admin")) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    const userRole = (session?.user as unknown as { role?: string })?.role;

    if (!session) {
      return NextResponse.redirect(new URL("/auth/sign-in", request.url));
    }

    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  // Dashboard routes - require authentication
  if (pathname.startsWith("/dashboard")) {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    if (!session) {
      return NextResponse.redirect(new URL("/auth/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/api/auth/:path*",
    "/auth/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
