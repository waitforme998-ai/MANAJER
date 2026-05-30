import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client bound to the current request's cookie store.
 * MUST only be called from Server Components, Server Actions, or Route Handlers.
 *
 * Security note: Uses @supabase/ssr which correctly handles cookie-based
 * session management, enabling getUser() to verify against the Supabase
 * Auth server (not just parsing the local JWT).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — cookie writes are handled
            // by the middleware refresh cycle. Safe to ignore here.
          }
        },
      },
    }
  );
}
