import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// createBrowserClient from @supabase/ssr automatically handles cookies
// so client-side and server-side auth sessions are always perfectly in sync
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
