import { z } from "zod";

// ─── SHARED SANITIZER ─────────────────────────────────────────────────────────
// Strips HTML/script tags from any string field to prevent stored XSS.
const sanitize = (val: string) =>
  val.replace(/<[^>]*>?/gm, "").replace(/javascript:/gi, "");

const safeString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Must be at least ${min} characters.`)
    .max(max, `Must not exceed ${max} characters.`)
    .transform(sanitize);

// ─── LEAD SUBMISSION (IntakeCard form) ────────────────────────────────────────
export const LeadSchema = z.object({
  business_name: safeString(1, 200),
  category: safeString(1, 200),
  region: safeString(1, 200),
  current_system: safeString(1, 500),
  monthly_volume: safeString(1, 200),
  // Strict phone: optional leading +, digits/spaces/dashes/parens, 7–20 chars
  whatsapp_num: z
    .string()
    .trim()
    .min(7, "Phone number too short.")
    .max(20, "Phone number too long.")
    .regex(
      /^\+?[\d\s\-()\u0660-\u0669]{7,20}$/,
      "Invalid phone number format."
    ),
  // RFC-5321 max email length is 320 chars
  email: z.string().trim().email("Invalid email address.").max(320),
});

export type LeadPayload = z.infer<typeof LeadSchema>;

// ─── ADMIN REVIEW ACTIONS ─────────────────────────────────────────────────────
// UUID v4 only — prevents IDOR via malformed / sequential IDs
export const ReviewIdSchema = z
  .string()
  .uuid("Invalid review identifier format.");

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const LoginEmailSchema = z
  .string()
  .trim()
  .email("Invalid email address.")
  .max(320);
