import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "tp-session";

interface TokenPayload {
  role?: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Routes accessible without authentication.
 *
 * - /login                         - admin login page
 * - /form/:path*                   - public client order forms
 * - /api/auth/login                - login endpoint
 * - /api/auth/logout               - logout endpoint
 * - /api/tokens/:path*             - public token validation & order submission
 * - /api/promo-codes/validate      - public promo code validation
 */
function isPublicRoute(pathname: string, method: string): boolean {
  // Login page
  if (pathname === "/login") return true;

  // Public form pages
  if (pathname.startsWith("/form/") || pathname === "/form") return true;

  // Auth login endpoint
  if (pathname === "/api/auth/login" && method === "POST") return true;

  // Auth logout endpoint (needs to be accessible to clear cookie)
  if (pathname === "/api/auth/logout" && method === "POST") return true;

  // Public token endpoints: /api/tokens/[uuid] (GET for validation, POST for order submission)
  // /api/tokens (no param) is admin-only for listing/creation
  if (
    pathname.startsWith("/api/tokens/") &&
    pathname !== "/api/tokens/" &&
    (method === "GET" || method === "POST")
  ) {
    return true;
  }

  // Public promo code validation
  if (pathname === "/api/promo-codes/validate" && method === "POST") return true;

  return false;
}

function isDashboardRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/tokens") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/stats") ||
    pathname.startsWith("/categories") ||
    pathname.startsWith("/drivers") ||
    pathname.startsWith("/delivery-map") ||
    pathname.startsWith("/promo-codes") ||
    pathname === "/"
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Allow public routes through
  if (isPublicRoute(pathname, method)) {
    return NextResponse.next();
  }

  // Check for valid session on protected routes
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    // API routes get a 401 JSON response; pages get redirected to login
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = (payload as TokenPayload).role;

    // Redirect drivers away from dashboard routes
    if (role === "driver" && isDashboardRoute(pathname)) {
      const driverUrl = new URL("/driver", request.url);
      return NextResponse.redirect(driverUrl);
    }

    // Redirect admins away from driver app routes (pages only, not API)
    // Must match /driver exactly or /driver/... but NOT /drivers (admin page)
    if (
      role !== "driver" &&
      (pathname === "/driver" || pathname.startsWith("/driver/")) &&
      !pathname.startsWith("/drivers") &&
      !pathname.startsWith("/api/driver")
    ) {
      const dashboardUrl = new URL("/", request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.next();
  } catch {
    // Invalid or expired token
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }
    // Pages: clear cookie and redirect to login
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - Static assets (images, fonts, etc.)
     */
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
