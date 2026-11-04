import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSessionToken } from "@/lib/admin-session";

const protectedPrefixes = ["/admin", "/data-pulls", "/database"];
const protectedApiPrefixes = ["/api/ingest", "/api/export"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedApiPath(pathname: string) {
  return protectedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const privateInventory = pathname === "/inventory" && request.nextUrl.searchParams.get("mode") !== "public";

  // 1. Protect Web Pages (Redirect to actual UI login page)
  if (isProtectedPath(pathname) || privateInventory) {
    const adminSession = request.cookies.get("admin_session")?.value;
    if (!await verifyAdminSessionToken(adminSession, process.env.ADMIN_SESSION_SECRET)) {
      const loginUrl = new URL("/admin-login", request.url);
      loginUrl.searchParams.set("from", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Protect API Routes (Return 401 JSON without WWW-Authenticate header to prevent browser popups)
  if (isProtectedApiPath(pathname)) {
    if (await verifyAdminSessionToken(request.cookies.get("admin_session")?.value, process.env.ADMIN_SESSION_SECRET)) {
      return NextResponse.next();
    }
    const expectedUser = process.env.ADMIN_BASIC_USER;
    const expectedPassword = process.env.ADMIN_BASIC_PASSWORD;

    const header = request.headers.get("authorization");
    if (expectedUser && expectedPassword && header?.startsWith("Basic ")) {
      try {
        const decoded = atob(header.slice("Basic ".length));
        const separator = decoded.indexOf(":");
        if (separator < 0) throw new Error("Malformed Basic authorization header");
        const user = decoded.slice(0, separator);
        const password = decoded.slice(separator + 1);
        if (user === expectedUser && password === expectedPassword) {
          return NextResponse.next();
        }
      } catch {
        // Fall through to 401
      }
    }

    return new NextResponse(JSON.stringify({ error: "Unauthorized. Admin credentials required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/data-pulls/:path*", "/database/:path*", "/inventory", "/api/ingest/:path*", "/api/export"]
};
