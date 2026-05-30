"use server";

/**
 * ─── SECURITY LAYER 3: SERVER ACTIONS (Admin & Member mutations) ────────────
 *
 * Every action re-verifies session identity server-side before touching the DB.
 *
 * Security principles enforced:
 * - getUser() — server-verified JWT, not local cookie parsing
 * - Zod UUID validation — prevents IDOR via malformed / sequential IDs
 * - Generic error messages — raw DB errors never reach the client
 * - Structured server-side logging — every failure is traceable
 */

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ReviewIdSchema } from "@/lib/validation";
import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// Single source of truth for the allowed admin email
const ALLOWED_ADMIN_EMAIL = "manajer.pk@gmail.com" as const;

// Generic client-facing error — never exposes system internals
const GENERIC_ERROR = "Operational failure. Action logged." as const;

// ─── ACTION RESULT TYPE ───────────────────────────────────────────────────────
export type ActionResult =
  | { success: true }
  | { success: false; error: string };

// ─── INTERNAL: VERIFIED ADMIN SESSION ────────────────────────────────────────
async function requireAdminSession(): Promise<
  Awaited<ReturnType<typeof createSupabaseServerClient>> | null
> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    console.warn("[SECURITY][UNAUTHENTICATED_ACTION_ATTEMPT]", {
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  let isAllowed = user.email === ALLOWED_ADMIN_EMAIL;

  // Dual-mode auth check fallback: check dynamic admin_users table if user.email !== ROOT
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
      console.warn("[ControlCenter Actions] admin_users table check bypassed (not created yet).");
    }
  }

  if (!isAllowed) {
    console.warn("[SECURITY][UNAUTHORIZED_ACTION_ATTEMPT]", {
      email: user.email,
      timestamp: new Date().toISOString(),
    });
    return null;
  }

  return supabase;
}

// ─── APPROVE REVIEW ───────────────────────────────────────────────────────────
export async function approveReview(rawId: unknown): Promise<ActionResult> {
  const parsed = ReviewIdSchema.safeParse(rawId);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  const supabase = await requireAdminSession();
  if (!supabase) {
    return { success: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase
    .from("reviews")
    .update({ is_approved: true })
    .eq("id", parsed.data);

  if (error) {
    console.error("[SECURITY][APPROVE_REVIEW_DB_FAILURE]", {
      id: parsed.data,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: GENERIC_ERROR };
  }

  return { success: true };
}

// ─── DELETE REVIEW ────────────────────────────────────────────────────────────
export async function deleteReview(rawId: unknown): Promise<ActionResult> {
  const parsed = ReviewIdSchema.safeParse(rawId);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  const supabase = await requireAdminSession();
  if (!supabase) {
    return { success: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", parsed.data);

  if (error) {
    console.error("[SECURITY][DELETE_REVIEW_DB_FAILURE]", {
      id: parsed.data,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: GENERIC_ERROR };
  }

  return { success: true };
}

// ─── DELETE LEAD ──────────────────────────────────────────────────────────────
export async function deleteLead(rawId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid("Invalid lead identifier format.").safeParse(rawId);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  const supabase = await requireAdminSession();
  if (!supabase) {
    return { success: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", parsed.data);

  if (error) {
    console.error("[SECURITY][DELETE_LEAD_DB_FAILURE]", {
      id: parsed.data,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: GENERIC_ERROR };
  }

  return { success: true };
}

// ─── DEPLOY SYSTEM (Lead status update) ───────────────────────────────────────
export async function deploySystem(leadId: unknown): Promise<ActionResult> {
  const parsed = z.string().uuid("Invalid lead identifier format.").safeParse(leadId);
  if (!parsed.success) {
    return { success: false, error: GENERIC_ERROR };
  }

  const supabase = await requireAdminSession();
  if (!supabase) {
    return { success: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase
    .from("leads")
    .update({ status: "DEPLOYED" })
    .eq("id", parsed.data);

  if (error) {
    console.error("[SECURITY][DEPLOY_SYSTEM_DB_FAILURE]", {
      id: parsed.data,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: GENERIC_ERROR };
  }

  return { success: true };
}

// ─── SIGN OUT ─────────────────────────────────────────────────────────────────
export async function signOutAdmin(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("[SIGN_OUT_FAILURE]", error.message);
    return { success: false, error: GENERIC_ERROR };
  }

  return { success: true };
}

// ─── SUBMIT MEMBER REVIEW (Self-Moderated Member Flow) ────────────────────────
export async function submitMemberReview(
  role: string,
  feedback: string,
  rating: number
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be authenticated to submit telemetry reviews." };
  }

  // Fetch profiles table for the display name and avatar_url
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "Anonymous Member";
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || null;

  const cleanRole = role.trim().slice(0, 120);
  const cleanFeedback = feedback.trim().slice(0, 1000);
  const cleanRating = Math.max(1, Math.min(5, rating));

  if (cleanFeedback.length < 10) {
    return { success: false, error: "Review feedback must be at least 10 characters." };
  }

  const { error } = await supabase
    .from("reviews")
    .insert([
      {
        name: displayName,
        role: cleanRole,
        feedback: cleanFeedback,
        rating: cleanRating,
        is_approved: false, // Default is false, needs admin verification
        submitted_by: user.id,
        email: user.email,
        avatar_url: avatarUrl
      }
    ]);

  if (error) {
    console.error("[MEMBER_REVIEW_SUBMISSION_FAILURE]", error.message);
    return { success: false, error: GENERIC_ERROR };
  }

  return { success: true };
}

// ─── SUBMIT TELEMETRY LEAD (Secure Server Action with Captcha & libphonenumber Validation) ───
export async function submitLeadForm(
  formData: {
    business_name: string;
    category: string;
    region: string;
    current_system: string;
    monthly_volume: string;
    whatsapp_num: string;
    email: string;
  },
  captchaToken?: string
): Promise<ActionResult> {
  // 1. Zod schema validation + libphonenumber-js format check
  const LeadSchema = z.object({
    business_name: z.string().trim().min(1, "Business name is required."),
    category: z.string().trim().min(1, "Category is required."),
    region: z.string().trim().min(1, "Region is required."),
    current_system: z.string().trim().min(1, "Current system is required."),
    monthly_volume: z.string().trim().min(1, "Monthly volume is required."),
    whatsapp_num: z.string().trim().refine((val) => {
      const cleaned = val.replace(/\s+/g, "");
      const phoneNumber = parsePhoneNumberFromString(val);
      return phoneNumber ? phoneNumber.isValid() : cleaned.length >= 7;
    }, "Invalid WhatsApp phone format. Please use international style (e.g. +92 300 1234567)"),
    email: z.string().trim().email("Invalid operational email address format."),
  });

  const parsed = LeadSchema.safeParse(formData);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || "Validation failed.";
    return { success: false, error: errorMsg };
  }

  // 2. Google reCAPTCHA / hCaptcha Security verification gate (if secret key configured)
  if (process.env.RECAPTCHA_SECRET_KEY) {
    if (!captchaToken) {
      return { success: false, error: "Security check is missing. Please try again." };
    }
    try {
      const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`;
      const res = await fetch(verifyUrl, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        return { success: false, error: "Security verification failed. Please try again." };
      }
    } catch (err) {
      console.error("[SECURITY][CAPTCHA_VERIFICATION_EXCEPTION]", err);
      return { success: false, error: "Security validation system timeout." };
    }
  }

  // 3. Server-side database insertion (RLS handles permissions)
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("leads")
    .insert([
      {
        ...parsed.data,
        status: "PENDING",
      },
    ]);

  if (error) {
    console.error("[DATABASE][LEAD_INSERTION_FAILURE]", error.message);
    return { success: false, error: "Lead could not be saved due to a server database exception." };
  }

  return { success: true };
}

// ─── GET ADMIN EMAILS ─────────────────────────────────────────────────────────
export async function getAdminEmails(): Promise<{ success: true; emails: string[] } | { success: false; error: string }> {
  const supabase = await requireAdminSession();
  if (!supabase) return { success: false, error: GENERIC_ERROR };

  try {
    const { data, error } = await supabase
      .from("admin_users")
      .select("email")
      .order("email");

    if (error) {
      // Table may not exist yet — return root admin only
      return { success: true, emails: [ALLOWED_ADMIN_EMAIL] };
    }

    const extra = (data ?? [])
      .map((r: { email: string }) => r.email)
      .filter((e: string) => e !== ALLOWED_ADMIN_EMAIL);

    return { success: true, emails: [ALLOWED_ADMIN_EMAIL, ...extra] };
  } catch {
    return { success: true, emails: [ALLOWED_ADMIN_EMAIL] };
  }
}

// ─── ADD ADMIN EMAIL ──────────────────────────────────────────────────────────
export async function addAdminEmail(rawEmail: unknown): Promise<ActionResult> {
  const parsed = z.string().email("Invalid email address.").safeParse(rawEmail);
  if (!parsed.success) return { success: false, error: "Please enter a valid email address." };

  const supabase = await requireAdminSession();
  if (!supabase) return { success: false, error: GENERIC_ERROR };

  if (parsed.data === ALLOWED_ADMIN_EMAIL) {
    return { success: false, error: "That email is already the root admin." };
  }

  try {
    const { error } = await supabase
      .from("admin_users")
      .upsert({ email: parsed.data.toLowerCase().trim() }, { onConflict: "email" });

    if (error) {
      console.error("[ADD_ADMIN_EMAIL_FAILURE]", error.message);
      return { success: false, error: GENERIC_ERROR };
    }
    return { success: true };
  } catch (err) {
    console.error("[ADD_ADMIN_EMAIL_UNEXPECTED]", err);
    return { success: false, error: GENERIC_ERROR };
  }
}

// ─── REMOVE ADMIN EMAIL ───────────────────────────────────────────────────────
export async function removeAdminEmail(rawEmail: unknown): Promise<ActionResult> {
  const parsed = z.string().email("Invalid email address.").safeParse(rawEmail);
  if (!parsed.success) return { success: false, error: "Invalid email address." };

  if (parsed.data === ALLOWED_ADMIN_EMAIL) {
    return { success: false, error: "Cannot remove the root admin email." };
  }

  const supabase = await requireAdminSession();
  if (!supabase) return { success: false, error: GENERIC_ERROR };

  try {
    const { error } = await supabase
      .from("admin_users")
      .delete()
      .eq("email", parsed.data.toLowerCase().trim());

    if (error) {
      console.error("[REMOVE_ADMIN_EMAIL_FAILURE]", error.message);
      return { success: false, error: GENERIC_ERROR };
    }
    return { success: true };
  } catch (err) {
    console.error("[REMOVE_ADMIN_EMAIL_UNEXPECTED]", err);
    return { success: false, error: GENERIC_ERROR };
  }
}
