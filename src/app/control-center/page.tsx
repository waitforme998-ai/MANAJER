/**
 * ─── SECURITY LAYER 2: SERVER COMPONENT DOUBLE-CHECK ────────────────────────
 *
 * Middleware (Layer 1) already blocked unauthorized requests at the Edge.
 * This is defense-in-depth: we re-verify with getUser() on the server before
 * rendering a single DOM node or executing any DB query.
 *
 * Data is fetched server-side in parallel and passed to the Command Center client as props,
 * so the client never needs direct DB access for the initial render.
 */

import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import CommandCenter from "./CommandCenter";

const ALLOWED_ADMIN_EMAIL = "manajer.pk@gmail.com" as const;

type Review = {
  id: string;
  name: string;
  role: string;
  feedback: string;
  rating: number;
  is_approved: boolean;
  created_at: string;
};

type Lead = {
  id: string;
  business_name: string;
  category: string;
  region: string;
  current_system: string;
  monthly_volume: string;
  whatsapp_num: string;
  email: string;
  status: string;
  created_at: string;
};

export default async function ControlCenterPage() {
  const supabase = await createSupabaseServerClient();

  // Layer 2: Server-side re-verification (getUser contacts Auth server)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    notFound(); // Throw strict 404 to hide the existence of this route
  }

  let isAllowed = user.email === ALLOWED_ADMIN_EMAIL;

  // Dynamic Auth Fallback: Check admin_users list if not root admin email
  if (!isAllowed) {
    try {
      const { data: adminRecord, error: adminError } = await supabase
        .from("admin_users")
        .select("email")
        .eq("email", user.email)
        .maybeSingle();

      if (!adminError && adminRecord) {
        isAllowed = true;
      }
    } catch (err) {
      console.warn("[ControlCenter Server] Bypassing admin_users check (table does not exist yet).");
    }
  }

  // Absolute authorization gate
  if (!isAllowed) {
    notFound(); // Throw strict 404
  }

  // Parallel Ingestion: Fetch both tables simultaneously to minimize latency under 3G/4G Pakistan networks
  const [reviewsResponse, leadsResponse] = await Promise.all([
    supabase
      .from("reviews")
      .select("id, name, role, feedback, rating, is_approved, created_at, email, avatar_url")
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, business_name, category, region, current_system, monthly_volume, whatsapp_num, email, status, created_at")
      .order("created_at", { ascending: false })
  ]);

  if (reviewsResponse.error) {
    console.error("[CONTROL_CENTER_REVIEWS_FETCH_ERROR]", reviewsResponse.error.message);
  }
  if (leadsResponse.error) {
    console.error("[CONTROL_CENTER_LEADS_FETCH_ERROR]", leadsResponse.error.message);
  }

  const initialReviews: Review[] = reviewsResponse.data ?? [];
  const initialLeads: Lead[] = leadsResponse.data ?? [];

  // Recover Google details from metadata or profiles table
  const metaName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.display_name ||
    null;

  const metaAvatar =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null;

  let adminName = metaName;
  let adminAvatarUrl = metaAvatar;

  // Fallback to database query if incomplete
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profile) {
      adminName = adminName || profile.display_name;
      adminAvatarUrl = adminAvatarUrl || profile.avatar_url;
    }
  } catch (err) {
    console.warn("[ControlCenter Page] Fallback profile retrieval failed:", err);
  }

  return (
    <CommandCenter
      initialReviews={initialReviews}
      initialLeads={initialLeads}
      adminEmail={user.email}
      adminName={adminName}
      adminAvatarUrl={adminAvatarUrl}
    />
  );
}
