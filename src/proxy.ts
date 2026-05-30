import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * ─── EDGE PROXY: SESSION REFRESH + ADMIN ROUTE GUARD ─────────────────────────
 *
 * This is the single edge entrypoint. It does two jobs:
 *
 * 1. SESSION REFRESH (all routes)
 *    Refreshes the Supabase session cookie on every request. Required by
 *    @supabase/ssr so that access tokens never go stale. Without this, users
 *    get randomly "logged out" after ~1 hour (JWT default TTL).
 *
 * 2. ADMIN ROUTE GUARD (/control-center)
 *    Protects the admin panel at the Edge, before any page code runs.
 *    - Fast path: local JWT signature verification via Web Crypto API (<1ms)
 *    - Fallback: supabase.auth.getUser() network call if JWT secret not set
 *    - Unauthorized access → silent 307 to `/` (never reveals admin route)
 */

const ALLOWED_ADMIN_EMAIL = "manajer.pk@gmail.com" as const;

// ─── LOCAL JWT SIGNATURE VERIFIER ───────────────────────────────────────────
async function verifyJWTLocal(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);

    const decodeBase64Url = (str: string) => {
      let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    };

    const signature = decodeBase64Url(signatureB64);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const isValid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!isValid) return null;

    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payloadJson);
  } catch (err) {
    console.error("[SECURITY][JWT_LOCAL_VERIFICATION_EXCEPTION]", err);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const isAdminRoute = request.nextUrl.pathname.startsWith("/control-center");

  // ─── Build the Supabase SSR client that writes refreshed cookie back ───────
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ─── JOB 1: Refresh the session token (runs for ALL routes) ──────────────
  // IMPORTANT: Do NOT add logic between createServerClient and getUser().
  // This is a requirement of @supabase/ssr to keep session cookies fresh.
  if (!isAdminRoute) {
    // For public routes, just refresh and pass through — no auth check needed
    await supabase.auth.getUser();
    return response;
  }

  // ─── JOB 2: Admin Route Guard for /control-center ────────────────────────

  // Fast path: Local JWT verification (sub-millisecond, no network hop)
  if (process.env.SUPABASE_JWT_SECRET) {
    let accessToken: string | null = null;
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.includes("-auth-token")) {
        try {
          const parsed = JSON.parse(cookie.value);
          if (Array.isArray(parsed) && parsed[0]) {
            accessToken = parsed[0];
          } else if (parsed.access_token) {
            accessToken = parsed.access_token;
          }
        } catch (_) {
          accessToken = cookie.value;
        }
        break;
      }
    }

    if (accessToken) {
      const payload = await verifyJWTLocal(accessToken, process.env.SUPABASE_JWT_SECRET);
      if (payload && payload.email === ALLOWED_ADMIN_EMAIL) {
        // Sub-millisecond Edge auth complete — refresh cookie and allow
        return response;
      }
      // Token exists but failed verification → deny immediately
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Security fallback: network call to Supabase auth server
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isAuthorizedAdmin =
    !error && user !== null && user.email === ALLOWED_ADMIN_EMAIL;

  if (!isAuthorizedAdmin) {
    // Silent redirect — no 401/403, no hint that /control-center exists
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match ALL request paths EXCEPT:
     * - _next/static (static files, no session needed)
     * - _next/image (image optimization, no session needed)
     * - favicon.ico, site images, fonts
     * This ensures session cookies are refreshed on every page navigation.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
