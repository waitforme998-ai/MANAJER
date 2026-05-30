import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth Callback Route Handler
 *
 * Supabase magic-link / OAuth flows redirect here with a `code` parameter.
 * This route exchanges the code for a session (PKCE flow), writes the session
 * cookies, then redirects the user to their destination.
 *
 * Security: The code is single-use and expires quickly. If exchange fails,
 * we redirect to /login with a generic error — never exposing the raw error.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  // `next` param lets us send admin directly to /control-center after login
  const next = searchParams.get("next") ?? "/";

  // Prevent open redirect — only allow relative paths on our own origin
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Log server-side only, never expose to client
      console.error("[AUTH_CALLBACK_ERROR]", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }

    // Recover user to determine if they are the admin, and route to control-center if so
    const { data: { user } } = await supabase.auth.getUser();
    let finalNext = safeNext;
    if (user?.email === "manajer.pk@gmail.com") {
      finalNext = "/control-center";
    }

    return NextResponse.redirect(`${origin}${finalNext}`);
  } catch (err: unknown) {
    console.error("[AUTH_CALLBACK_UNEXPECTED]", err);
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }
}
