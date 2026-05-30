"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import ControlTower from "@/components/ControlTower";
import IntakeCard from "@/components/IntakeCard";
import { LoginEmailSchema } from "@/lib/validation";
import { supabase as supabaseClient } from "@/lib/supabase";
import { submitMemberReview } from "@/app/control-center/actions";
import { z } from "zod";
import { md5 } from "@/lib/hash";

const ADMIN_EMAIL = "manajer.pk@gmail.com";

export default function Home() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authName, setAuthName] = useState<string | null>(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [authAvatarUrl]);

  // Dynamic Reviews
  const [approvedReviews, setApprovedReviews] = useState<any[]>([]);

  // Floating Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginState, setLoginState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [loginErrorMsg, setLoginErrorMsg] = useState("");

  // Floating Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Sign-Out Confirmation Overlay Modal
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  /**
   * Fetches the user profile from Supabase.
   * metaNameFallback: name already extracted from user_metadata (e.g. display_name from OTP, full_name from Google)
   * If the profiles table row has no display_name yet (e.g. DB trigger hasn't run), we keep the metadata name.
   */
  const fetchProfile = async (userId: string, email: string, metaNameFallback?: string | null) => {
    try {
      // 1. Try fetching by user ID first
      let { data, error } = await supabaseClient
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      // 2. Fallback to query by email address to recover existing Google profile details
      if (error || !data || !data.avatar_url || !data.display_name) {
        const { data: emailData, error: emailErr } = await supabaseClient
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("email", email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!emailErr && emailData) {
          data = {
            display_name: data?.display_name || emailData.display_name,
            avatar_url: data?.avatar_url || emailData.avatar_url,
          };
        }
      }

      if (data) {
        if (data.display_name) {
          setAuthName(data.display_name);
        } else if (metaNameFallback) {
          setAuthName(metaNameFallback);
        }
        if (data.avatar_url) {
          setAuthAvatarUrl(data.avatar_url);
        }
      }
    } catch (err) {
      console.warn("[Profile Retrieval Failed]:", err);
    }
  };

  const fetchApprovedReviews = async () => {
    try {
      const { data, error } = await supabaseClient
        .from("reviews")
        .select("id, name, role, feedback, rating, created_at, submitted_by, email, avatar_url")
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setApprovedReviews(data);
      }
    } catch (err) {
      console.warn("[Reviews Retrieval Failed]:", err);
    }
  };

  useEffect(() => {
    supabaseClient.auth.getUser()
      .then(({ data: { user } }) => {
        if (user?.email) {
          setAuthEmail(user.email);
          setIsAdmin(user.email === ADMIN_EMAIL);
          setImgError(false);
          // Instant load from metadata — Google OAuth uses full_name/picture, OTP uses display_name
          const metaName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.user_metadata?.display_name ||
            null;
          if (metaName) setAuthName(metaName);

          const metaAvatar =
            user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            null;
          if (metaAvatar) setAuthAvatarUrl(metaAvatar);

          // Sync Google credentials to DB profiles table if logged in via Google OAuth!
          if (user.app_metadata?.provider === "google") {
            supabaseClient
              .from("profiles")
              .update({
                display_name: metaName,
                avatar_url: metaAvatar,
              })
              .eq("id", user.id)
              .then(({ error }) => {
                if (error) console.warn("[Google Profile Sync Error]:", error.message);
              });
          }

          // Fetch DB profile, passing metadata name as fallback so it always shows
          fetchProfile(user.id, user.email, metaName);
        }
      })
      .catch((err) => {
        console.warn("[Initial Auth Retrieval Failed]:", err);
      })
      .finally(() => {
        setAuthChecked(true);
      });

    // Listen for real-time auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setAuthEmail(email);
      setIsAdmin(email === ADMIN_EMAIL);
      setImgError(false);

      if (session?.user) {
        const metaName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.user_metadata?.display_name ||
          null;
        if (metaName) setAuthName(metaName);

        const metaAvatar =
          session.user.user_metadata?.avatar_url ||
          session.user.user_metadata?.picture ||
          null;
        if (metaAvatar) setAuthAvatarUrl(metaAvatar);

        // Sync Google credentials to DB profiles table if logged in via Google OAuth!
        if (session.user.app_metadata?.provider === "google") {
          supabaseClient
            .from("profiles")
            .update({
              display_name: metaName,
              avatar_url: metaAvatar,
            })
            .eq("id", session.user.id)
            .then(({ error }) => {
              if (error) console.warn("[Google Profile Sync Error]:", error.message);
            });
        }

        // Pass metadata name as fallback in case profiles row isn't created yet
        fetchProfile(session.user.id, session.user.email || "", metaName);
        setShowLoginModal(false);
      } else {
        setAuthName(null);
        setAuthAvatarUrl(null);
      }
    });

    fetchApprovedReviews();

    // Open login modal if redirected with ?login=true
    const params = new URLSearchParams(window.location.search);
    if (params.get("login") === "true") {
      setShowLoginModal(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    /**
     * BFCACHE FIX — the core bug:
     *
     * When the user clicks "Continue with Google", the browser navigates away.
     * React state freezes at: loginState="sending", showLoginModal=true.
     *
     * If Google rejects the login (error 400, mismatched URI, etc.) and the user
     * clicks Back, the browser restores the page from bfcache — it does NOT
     * re-run useEffect. The modal backdrop (fixed inset-0 z-[100]) is invisible
     * but covers the entire screen, blocking every button click underneath.
     *
     * The pageshow event fires on EVERY page load AND on bfcache restore.
     * event.persisted === true means it's a bfcache restore (not a fresh load).
     * We reset all modal + login state so the UI is instantly interactive again.
     */
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache after back/forward navigation
        setShowLoginModal(false);
        setShowSignOutConfirm(false);
        setLoginState("idle");
        setLoginErrorMsg("");
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    // Secondary safety net: reset if tab becomes visible again (e.g. alt-tab back)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setShowSignOutConfirm(false);
        // Only close login modal if we're not in "sent" state (don't disrupt OTP flow)
        setLoginState((prev) => (prev === "sending" ? "idle" : prev));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const emailParsed = LoginEmailSchema.safeParse(loginEmail);
    if (!emailParsed.success) {
      setLoginErrorMsg("Please enter a valid email address.");
      setLoginState("error");
      return;
    }

    if (loginName.trim().length < 2) {
      setLoginErrorMsg("Name must be at least 2 characters.");
      setLoginState("error");
      return;
    }

    setLoginState("sending");
    setLoginErrorMsg("");

    const isRootAdmin = emailParsed.data.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const nextPath = isRootAdmin ? "/control-center" : "/";
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    try {
      const { error } = await supabaseClient.auth.signInWithOtp({
        email: emailParsed.data,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            display_name: loginName.trim(),
          }
        },
      });

      if (error) {
        console.error("[MAGIC_LINK_ERROR]", error.message);
        setLoginErrorMsg("Unable to send login link. Please check your email and try again.");
        setLoginState("error");
        return;
      }

      setLoginState("sent");
    } catch (err: unknown) {
      console.error("[MAGIC_LINK_UNEXPECTED]", err);
      setLoginErrorMsg("Unable to send login link. Please check your email and try again.");
      setLoginState("error");
    }
  };

  const handleGoogleLogin = async (): Promise<void> => {
    setLoginState("sending");
    setLoginErrorMsg("");
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (error) {
        console.error("[GOOGLE_AUTH_ERROR]", error.message);
        setLoginErrorMsg(error.message);
        setLoginState("error");
      }
    } catch (err: unknown) {
      console.error("[GOOGLE_AUTH_UNEXPECTED]", err);
      setLoginErrorMsg("Google auth initialization failed.");
      setLoginState("error");
    }
  };

  const executeSignOut = async () => {
    await supabaseClient.auth.signOut();
    setAuthEmail(null);
    setAuthName(null);
    setIsAdmin(false);
    setShowSignOutConfirm(false);
  };

  return (
    <div className="relative min-h-screen text-white flex flex-col items-center">
      {/* Drifting blueprint background */}
      <div className="bg-blueprint" />

      {/* ── FLOATING GLASS HEADER ── */}
      <header
        className="fixed top-3 md:top-6 left-1/2 -translate-x-1/2 w-[94%] md:w-[90%] max-w-5xl h-14 md:h-16 rounded-full px-3.5 md:px-6 flex items-center justify-between select-none glass-capsule"
        style={{
          zIndex: 50,
          background: "rgba(6, 12, 28, 0.15)",
          backdropFilter: "blur(8px) saturate(120%)",
          WebkitBackdropFilter: "blur(8px) saturate(120%)",
          border: "1px solid rgba(0, 242, 254, 0.15)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)",
        }}
      >
        <div className="flex items-center gap-2 md:gap-3">
          <Image src="/logo.webp" alt="MANAJER" width={32} height={32} className="md:w-[38px] md:h-[38px] object-contain -mr-0.5" priority />
          <span className="hidden sm:inline text-xs md:text-sm tracking-widest font-mono font-extrabold text-white">MANAJER.PK</span>
        </div>

        <div className="flex-1 hidden md:block" />

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden xs:flex items-center gap-1.5 text-[8px] md:text-[9px] font-mono font-bold tracking-widest uppercase">
            <span className="px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-400 bg-emerald-500/[0.08]">LIVE</span>
          </div>

          {authChecked && (
            <>
              {authEmail && (
                <div className="flex items-center gap-2 md:gap-3">
                  {isAdmin && (
                    <button
                      onClick={() => router.push("/control-center")}
                      className="flex items-center gap-1 sm:gap-1.5 h-7.5 px-2.5 sm:h-8 sm:px-3.5 rounded-full border border-[#00F2FE]/25 bg-[#060C1C]/65 hover:bg-[#00F2FE]/15 hover:border-[#00F2FE]/50 text-[8.5px] sm:text-[9.5px] font-mono font-bold uppercase tracking-widest text-[#00F2FE] transition-all duration-200 apple-btn-interactive"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 11.25c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.853-.464-3.597-1.282-5.13A11.952 11.952 0 0112 2.714z" />
                      </svg>
                      <span className="hidden xs:inline">Control</span>
                      <span className="hidden sm:inline"> Center</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 md:gap-2 border border-white/10 bg-white/[0.03] rounded-full p-1 sm:pl-2 sm:pr-3.5 sm:py-1 select-none animate-in fade-in duration-300">
                    {(() => {
                      const avatarSrc = authAvatarUrl;
                      return avatarSrc && !imgError ? (
                        <img
                          src={avatarSrc}
                          alt={authName || ""}
                          onError={() => setImgError(true)}
                          className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full border border-white/10 shrink-0 object-cover"
                        />
                      ) : (
                        <div className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00F2FE] border border-white/10 flex items-center justify-center font-mono font-extrabold text-[8.5px] sm:text-[9.5px] text-white uppercase shrink-0">
                          {authName ? authName.slice(0, 2) : authEmail.slice(0, 2)}
                        </div>
                      );
                    })()}
                    <span className="text-[8.5px] sm:text-[10px] font-mono font-bold text-white uppercase tracking-wider truncate max-w-[65px] sm:max-w-[120px] ml-1">
                      {authName || authEmail.split("@")[0]}
                    </span>
                  </div>

                  <button
                    onClick={() => setShowSignOutConfirm(true)}
                    className="text-[8.5px] sm:text-[9px] font-mono text-neutral-500 hover:text-red-400 transition-colors uppercase tracking-widest focus:outline-none cursor-pointer"
                  >
                    Sign out
                  </button>
                </div>
              )}

              {!authEmail && (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-[#060C1C]/65 text-[#00F2FE] hover:text-white hover:bg-[#00F2FE]/15 text-[8.5px] sm:text-[10px] font-sans font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(0,242,254,0.12)] border border-[#00F2FE]/25 flex items-center justify-center focus:outline-none apple-btn-interactive cursor-pointer"
                >
                  Member Login
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex flex-col justify-center items-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-[#00F2FE]/20 hover:border-[#00F2FE]/60 bg-[#060C1C]/45 hover:bg-[#00F2FE]/10 transition-all duration-300 cursor-pointer focus:outline-none apple-btn-interactive"
            aria-label="Toggle Telemetry Sidebar"
          >
            <div className="flex flex-col gap-[4px] sm:gap-[5px] w-[14px] sm:w-[18px]">
              <span className={`h-[1px] sm:h-[1.5px] w-full bg-white rounded-full transition-all duration-300 origin-center ${sidebarOpen ? "rotate-45 translate-y-[5px] sm:translate-y-[6.5px]" : ""}`} />
              <span className={`h-[1px] sm:h-[1.5px] w-full bg-white rounded-full transition-all duration-300 ${sidebarOpen ? "opacity-0" : ""}`} />
              <span className={`h-[1px] sm:h-[1.5px] w-full bg-white rounded-full transition-all duration-300 origin-center ${sidebarOpen ? "-rotate-45 -translate-y-[5px] sm:-translate-y-[6.5px]" : ""}`} />
            </div>
          </button>
        </div>
      </header>

      {/* ── SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60" style={{ zIndex: 40 }} onClick={() => setSidebarOpen(false)} />
      )}
      <ControlTower isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} authEmail={authEmail} authName={authName} />

      {/* ── MAIN CONTENT ── */}
      <main className="w-full min-h-screen flex flex-col justify-start items-center pt-28 pb-16">
        <div className="w-full max-w-2xl px-6 flex flex-col items-center">
          <div className="w-full flex flex-col items-start gap-3 mb-4 border-b border-white/5 pb-4 select-none">
            <div className="font-mono text-[9.5px] font-extrabold text-[#3B82F6] tracking-[0.3em] uppercase">
              START YOUR PROJECT WITH US
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase leading-[1.1] max-w-xl">
              We Build Custom Software and Systems to Scale Your Business.
            </h1>
            <p className="text-white/60 text-xs md:text-sm max-w-lg mt-1 leading-relaxed">
              We design secure databases, custom cloud infrastructure, and workflows to automate your operations.
            </p>
            <div className="font-mono text-[10px] font-bold tracking-wider uppercase mt-4 flex flex-wrap gap-x-5 gap-y-1.5 items-center bg-[#081225]/50 border border-white/5 px-3.5 py-2 rounded-lg backdrop-blur-md">
              <span className="text-white/70">↑ 99.9% Uptime</span>
              <span className="text-white/20 select-none">·</span>
              <span className="text-white/70">AES-256 Encrypted</span>
              <span className="text-white/20 select-none">·</span>
              <span className="text-[#3B82F6]">100+ Systems Deployed</span>
            </div>
          </div>

          <IntakeCard />

          {/* Testimonial Banner showing dynamic verified reviews */}
          <TestimonialBanner 
            reviews={approvedReviews} 
            authEmail={authEmail} 
            onWriteReview={() => setShowReviewModal(true)} 
            onTriggerLogin={() => setShowLoginModal(true)}
          />
        </div>
      </main>

      {/* ── SECURE FLOATING LOGIN MODAL ── */}
      {showLoginModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="w-full max-w-sm bg-[#080D1D]/95 border border-white/10 rounded-2xl p-8 relative shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-modal-card text-left flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 border border-white/10 hover:border-white/20 bg-white/5 text-white/50 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none apple-btn-interactive"
              aria-label="Close Login Modal"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-sans font-extrabold tracking-widest text-[#3B82F6] uppercase">
                Member Access
              </span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                Sign In to Portal
              </h2>
              <p className="text-[11.5px] text-neutral-400 leading-relaxed">
                Enter your name and email to receive a passwordless credentials handshake. New accounts register instantly.
              </p>
            </div>

            {loginState === "sent" ? (
              <div className="flex flex-col items-center gap-5 py-6 border border-white/5 bg-[#040712]/50 rounded-xl">
                <div className="w-12 h-12 rounded-full border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center text-emerald-400 text-lg">
                  ✓
                </div>
                <div className="text-center flex flex-col gap-1.5 px-4">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Handshake Sent
                  </span>
                  <span className="text-[11px] text-neutral-400 font-sans leading-normal">
                    Secure verification link routed to: <br/>
                    <span className="text-[#3B82F6] font-semibold">{loginEmail}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginState("idle");
                    setLoginEmail("");
                    setLoginName("");
                  }}
                  className="px-4 py-2 text-[10px] font-semibold text-neutral-400 hover:text-white uppercase tracking-wider transition-all duration-200"
                >
                  ← Use different email
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loginState === "sending"}
                  className="w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-wider text-white transition-all duration-200 flex items-center justify-center gap-2.5 apple-btn-interactive focus:outline-none"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 select-none py-1">
                  <div className="flex-1 h-[1px] bg-white/5" />
                  <span className="text-[8px] font-mono font-bold tracking-widest text-neutral-600 uppercase">or magic link OTP</span>
                  <div className="flex-1 h-[1px] bg-white/5" />
                </div>

                <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-name" className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Your Full Name</label>
                  <input
                    id="login-name"
                    type="text"
                    required
                    value={loginName}
                    onChange={(e) => {
                      setLoginName(e.target.value);
                      if (loginState === "error") setLoginState("idle");
                    }}
                    placeholder="Enter your name"
                    autoComplete="name"
                    autoFocus
                    className="w-full bg-[#040712]/60 border border-white/10 focus:border-[#3B82F6]/60 focus:ring-1 focus:ring-[#3B82F6]/20 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-600 outline-none transition-all duration-200"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email" className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Email Address</label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginState === "error") setLoginState("idle");
                    }}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="w-full bg-[#040712]/60 border border-white/10 focus:border-[#3B82F6]/60 focus:ring-1 focus:ring-[#3B82F6]/20 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-600 outline-none transition-all duration-200"
                  />
                </div>

                {loginState === "error" && loginErrorMsg && (
                  <div className="p-3 rounded-xl border border-red-500/25 bg-red-500/[0.03] text-red-400 text-[10.5px] font-semibold leading-normal animate-shake">
                    {loginErrorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginState === "sending" || !loginEmail.trim() || !loginName.trim()}
                  className="w-full py-3 rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-xs font-bold uppercase tracking-widest text-[#3B82F6] hover:text-white transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2 apple-btn-interactive focus:outline-none"
                >
                  {loginState === "sending" ? "Authenticating..." : "Request Access Token"}
                </button>
              </form>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ── PREMIUM MEMBER-ONLY REVIEW MODAL (SIGN-UP PRIVILEGE) ── */}
      {showReviewModal && authEmail && (
        <MemberReviewModal 
          authName={authName || authEmail.split("@")[0]} 
          onClose={() => setShowReviewModal(false)} 
        />
      )}

      {/* ── APPLE STYLE SIGN OUT CONFIRMATION MODAL OVERLAY ── */}
      {showSignOutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={() => setShowSignOutConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-[#080D1D]/95 border border-white/10 rounded-2xl p-6 relative shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-modal-card text-left flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-sans font-extrabold tracking-wider text-red-400 uppercase">
                Confirm Sign Out
              </span>
              <h2 className="text-base font-bold text-white tracking-wider">
                Are you sure you want to disconnect?
              </h2>
              <p className="text-[11.5px] text-neutral-400 font-sans leading-relaxed">
                Signing out will end your current active session and revoke telemetry database access. You will need to request a new magic link to submit system reviews.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 w-full">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="h-9.5 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-neutral-300 hover:text-white transition-all duration-200 focus:outline-none apple-btn-interactive"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSignOut}
                className="h-9.5 rounded-full border border-red-500/30 bg-red-950/20 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 hover:text-white transition-all duration-200 focus:outline-none apple-btn-interactive"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EXCLUSIVE MEMBER REVIEW FORM MODAL ───
type MemberReviewModalProps = {
  authName: string;
  onClose: () => void;
};

function MemberReviewModal({ authName, onClose }: MemberReviewModalProps) {
  const [role, setRole] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.trim().length < 10) {
      setErrorMsg("Review feedback must be at least 10 characters.");
      setStatus("error");
      return;
    }

    setBusy(true);
    setStatus("idle");
    setErrorMsg("");

    try {
      const result = await submitMemberReview(role, feedback, rating);
      setBusy(false);
      if (result.success) {
        setStatus("success");
        setRole("");
        setFeedback("");
        setRating(5);
      } else {
        setErrorMsg(result.error);
        setStatus("error");
      }
    } catch (err) {
      setBusy(false);
      setErrorMsg("An unexpected telemetry error occurred.");
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#080D1D]/95 border border-white/10 rounded-2xl p-6 md:p-8 relative shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-modal-card text-left flex flex-col gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 border border-white/10 hover:border-white/20 bg-white/5 text-white/50 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none apple-btn-interactive"
          aria-label="Close Review Modal"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-sans font-extrabold tracking-widest text-[#3B82F6] uppercase">
            Telemetry Feedback
          </span>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Add Telemetry Review
          </h2>
          <span className="text-[10px] text-neutral-500 font-sans tracking-wide">
            Author Account: <span className="text-white font-semibold">{authName}</span>
          </span>
        </div>

        {status === "success" ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4 text-center animate-in fade-in duration-300 bg-[#040712]/50 border border-white/5 rounded-xl p-5">
            <div className="w-12 h-12 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 flex items-center justify-center text-lg font-bold shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              ✓
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Review Received!</span>
              <p className="text-[11.5px] text-neutral-400 leading-relaxed font-sans max-w-xs">
                Thank you! Your review has been received and will appear on the site after verification.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 h-9 px-6 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-neutral-300 hover:text-white transition-all duration-200 apple-btn-interactive focus:outline-none"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Corporate Role / Title</label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., CTO, Apex Logistics"
                className="w-full bg-[#040712]/60 border border-white/10 focus:border-[#3B82F6]/60 focus:ring-1 focus:ring-[#3B82F6]/20 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-600 outline-none transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">System Rating Scale</label>
              <div className="flex items-center gap-2 h-9">
                {Array.from({ length: 5 }).map((_, i) => {
                  const val = i + 1;
                  const active = val <= rating;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(val)}
                      className={`text-2xl leading-none focus:outline-none hover:scale-110 transition-all ${
                        active ? "text-amber-500" : "text-neutral-800"
                      }`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400">Feedback Description</label>
              <textarea
                required
                rows={3}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Explain your operational experience..."
                className="w-full bg-[#040712]/60 border border-white/10 focus:border-[#3B82F6]/60 focus:ring-1 focus:ring-[#3B82F6]/20 rounded-xl px-4 py-3 text-xs text-white placeholder-neutral-600 outline-none transition-all duration-200 resize-none"
              />
            </div>

            {status === "error" && errorMsg && (
              <div className="p-3 rounded-xl border border-red-500/25 bg-red-500/[0.03] text-red-400 text-[10.5px] font-semibold leading-normal animate-shake">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-neutral-300 hover:text-white transition-all duration-200 focus:outline-none apple-btn-interactive"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="h-10 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-[11px] font-bold uppercase tracking-widest text-[#3B82F6] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 apple-btn-interactive focus:outline-none"
              >
                {busy ? "Submitting..." : "Log Review"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── DYNAMIC TESTIMONIAL CAROUSEL ───
type TestimonialBannerProps = {
  reviews: any[];
  authEmail: string | null;
  onWriteReview: () => void;
  onTriggerLogin: () => void;
};

function TestimonialBanner({ reviews, authEmail, onWriteReview, onTriggerLogin }: TestimonialBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  const prevReview = () => {
    setCurrentIndex((prev) => (prev === 0 ? reviews.length - 1 : prev - 1));
  };

  const nextReview = () => {
    setCurrentIndex((prev) => (prev === reviews.length - 1 ? 0 : prev + 1));
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      "from-blue-500 to-cyan-500",
      "from-purple-500 to-indigo-500",
      "from-emerald-500 to-teal-500",
      "from-amber-500 to-orange-500",
      "from-pink-500 to-rose-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  };

  const current = reviews[currentIndex];

  useEffect(() => {
    setImgError(false);
  }, [currentIndex, current?.email]);

  const emailHash = current?.email ? md5(current.email.trim().toLowerCase()) : "";
  const gravatarUrl = emailHash ? `https://www.gravatar.com/avatar/${emailHash}?d=404` : null;

  return (
    <div 
      className="w-full mt-4 p-6 rounded-2xl border border-white/5 bg-[#080D1D]/40 backdrop-blur-xl flex flex-col gap-4 text-left select-none shadow-[0_32px_80px_rgba(0,0,0,0.6)] glass-card apple-card-interactive"
      style={{
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
        <span className="text-[8.5px] font-mono font-bold tracking-[0.2em] text-[#3B82F6] uppercase">
          CLIENT FEEDBACK
        </span>
        <span className="text-[9.5px] font-mono text-neutral-500 uppercase tracking-widest">
          Verified Reviews
        </span>
      </div>

      {reviews.length === 0 ? (
        // Clean Minimalist Empty State
        <div className="py-6 flex flex-col items-center justify-center text-center gap-3 animate-in fade-in duration-300">
          <span className="text-xs font-semibold text-white/80">No Client Reviews Yet</span>
          <p className="text-[11.5px] text-neutral-400 max-w-sm leading-normal font-sans">
            Be the first registered client to share your experience working with us!
          </p>
          
          <div className="mt-2">
            {authEmail ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onWriteReview();
                }}
                className="h-8.5 px-4.5 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 text-[10px] font-bold uppercase tracking-widest text-[#3B82F6] hover:text-white transition-all duration-200 apple-btn-interactive focus:outline-none"
              >
                Write a Review
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTriggerLogin();
                }}
                className="h-8.5 px-4.5 rounded-full border border-white/15 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-neutral-300 hover:text-white transition-all duration-200 apple-btn-interactive focus:outline-none"
              >
                Sign In to Leave Feedback
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-[64px] flex flex-col justify-between animate-in fade-in duration-500">
          <p className="text-[11.5px] text-white/70 italic leading-relaxed transition-all duration-300">
            "{current.feedback}"
          </p>
          <div className="flex justify-between items-center border-t border-white/5 pt-3.5 mt-2">
            <div className="flex items-center gap-2.5">
              {(() => {
                const avatarSrc = current.avatar_url || gravatarUrl;
                return avatarSrc && !imgError ? (
                  <img
                    src={avatarSrc}
                    alt={current.name}
                    onError={() => setImgError(true)}
                    className="w-8 h-8 rounded-full border border-white/10 shrink-0 shadow-sm object-cover"
                  />
                ) : (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${getAvatarGradient(current.name || "")} border border-white/10 flex items-center justify-center font-mono font-extrabold text-[9.5px] text-white uppercase shrink-0 shadow-sm`}>
                    {(current.name || "AA").slice(0, 2)}
                  </div>
                );
              })()}
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold text-white leading-tight">
                  {current.name}
                </span>
                <span className="text-[8.5px] text-[#3B82F6] font-semibold mt-0.5 tracking-wide">
                  {current.role}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3.5">
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: current.rating || 5 }).map((_, i) => (
                    <svg key={i} className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>
                {/* Dynamically reveal add review only if signed in! */}
                {authEmail && (
                  <button
                    onClick={onWriteReview}
                    className="text-[8.5px] font-bold uppercase tracking-wider text-[#3B82F6] hover:underline focus:outline-none mt-0.5"
                  >
                    Add Review
                  </button>
                )}
              </div>
              
              <div className="flex gap-1.5">
                <button
                  onClick={prevReview}
                  className="w-6.5 h-6.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none apple-btn-interactive"
                  aria-label="Previous review"
                >
                  <svg className="w-2.5 h-2.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={nextReview}
                  className="w-6.5 h-6.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none apple-btn-interactive"
                  aria-label="Next review"
                >
                  <svg className="w-2.5 h-2.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
