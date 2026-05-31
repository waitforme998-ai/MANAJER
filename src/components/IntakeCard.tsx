"use client";

import { useState, useEffect, useRef } from "react";
import { submitLeadForm } from "@/app/control-center/actions";
import { supabase as supabaseClient } from "@/lib/supabase";

type LeadPayload = {
  business_name: string;
  category: string;
  region: string;
  current_system: string;
  monthly_volume: string;
  whatsapp_num: string;
  email: string;
};

const CATEGORY_PRESETS = [
  "E-Commerce / D2C",
  "Supply Chain Logistics",
  "Retail / Wholesale",
  "Automated Manufacturing"
];

const REGION_PRESETS = [
  "Pakistan (National)",
  "Middle East / GCC",
  "North America / EU"
];

const SYSTEM_PRESETS = [
  "Excel / Spreadsheets",
  "Legacy ERP / Desktop",
  "Manual Paper Ledger",
  "No System / Greenfield"
];

const VOLUME_PRESETS = [
  "less than 1,000 orders per month",
  "1,000 or 5,000 orders per month",
  "5,000 or 20,000 orders per month",
  "20,000 or 100,000 orders per month",
  "more than 100,000 orders per month"
];

export default function IntakeCard() {
  const [step, setStep] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const [formData, setFormData] = useState<LeadPayload>({
    business_name: "",
    category: "",
    region: "",
    current_system: "",
    monthly_volume: "",
    whatsapp_num: "",
    email: "",
  });

  const [status, setStatus] = useState<"IDLE" | "SUBMITTING" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [inputError, setInputError] = useState(false);
  const [showHydratedAlert, setShowHydratedAlert] = useState(false);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [loggedInName, setLoggedInName] = useState<string | null>(null);

  // Tracks if the user toggled custom input text field in presets
  const [customCategory, setCustomCategory] = useState(false);
  const [customRegion, setCustomRegion] = useState(false);
  const [customSystem, setCustomSystem] = useState(false);

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setLoggedInEmail(user.email);
        setFormData(prev => ({ ...prev, email: user.email! }));
        supabaseClient
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!error && data?.display_name) {
              setLoggedInName(data.display_name);
            }
          });
      }
    });

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;
      setLoggedInEmail(email);
      if (email) {
        setFormData(prev => ({ ...prev, email: email }));
        if (session?.user) {
          supabaseClient
            .from("profiles")
            .select("display_name")
            .eq("id", session.user.id)
            .maybeSingle()
            .then(({ data, error }) => {
              if (!error && data?.display_name) {
                setLoggedInName(data.display_name);
              }
            });
        }
      } else {
        setLoggedInName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const helpContainerRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss the "?" help modal from anywhere on the site
  useEffect(() => {
    if (!showHelp) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        helpContainerRef.current &&
        !helpContainerRef.current.contains(event.target as Node)
      ) {
        // Prevent immediate toggle conflict if clicking the help buttons themselves
        const isHelpButton = (event.target as Element).closest("[aria-label*='Toggle Technical Onboarding Help']");
        if (!isHelpButton) {
          setShowHelp(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showHelp]);

  // ─── LOCAL STORAGE FORM PERSISTENCE ───
  // Hydrate cached data on initial mount
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    try {
      const submitted = localStorage.getItem("manajer_lead_submitted");
      if (submitted === "true") {
        setStatus("SUCCESS");
        setStep(8);
        return;
      }

      const cached = localStorage.getItem("manajer_lead_intake");
      if (cached) {
        const parsed = JSON.parse(cached);
        let loadedData = false;
        
        if (parsed.formData) {
          setFormData((prev) => {
            const updated = { ...prev, ...parsed.formData };
            const hasData = Object.values(updated).some(val => val !== "");
            if (hasData) {
              loadedData = true;
            }
            return updated;
          });

          // Check if custom states should be hydrated
          const catVal = parsed.formData.category;
          if (catVal && !CATEGORY_PRESETS.includes(catVal)) {
            setCustomCategory(true);
          }
          
          const regVal = parsed.formData.region;
          if (regVal && !REGION_PRESETS.includes(regVal)) {
            setCustomRegion(true);
          }
          
          const sysVal = parsed.formData.current_system;
          if (sysVal && !SYSTEM_PRESETS.includes(sysVal)) {
            setCustomSystem(true);
          }
        }

        if (parsed.step && parsed.step >= 1 && parsed.step <= 7) {
          setStep(parsed.step);
          if (parsed.step > 1) {
            loadedData = true;
          }
        }

        if (loadedData) {
          setShowHydratedAlert(true);
          timer = setTimeout(() => setShowHydratedAlert(false), 5000);
        }
      }
    } catch (err) {
      console.warn("[Telemetry Cache Hydration Failure]:", err);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Debounced serialization of form fields to localStorage as the user types
  useEffect(() => {
    if (step >= 8) return; // Do not cache final completed state

    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          "manajer_lead_intake",
          JSON.stringify({ formData, step })
        );
      } catch (err) {
        console.warn("[Telemetry Cache Serialization Failure]:", err);
      }
    }, 400); // 400ms debounce interval

    return () => clearTimeout(timer);
  }, [formData, step]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePresetSelect = (fieldName: keyof LeadPayload, value: string, isCustom = false) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (fieldName === "category") setCustomCategory(isCustom);
    if (fieldName === "region") setCustomRegion(isCustom);
    if (fieldName === "current_system") setCustomSystem(isCustom);
  };

  const triggerErrorPulse = () => {
    setInputError(true);
    // Subtle high-tech beep alert
    const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQQAAAAAAAAD");
    audio.volume = 0.15;
    audio.play().catch(() => {});
    setTimeout(() => setInputError(false), 500);
  };

  const nextStep = () => {
    if (!isCurrentStepValid()) {
      triggerErrorPulse();
      return;
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => setStep((prev) => prev - 1);

  // ─── OPTIMISTIC LOADING & NON-BLOCKING SUBMISSION ───
  const submitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCurrentStepValid()) {
      triggerErrorPulse();
      return;
    }

    // Keep snapshots of current states in case of backend network failure rollback
    const prevFormData = { ...formData };
    const prevStep = step;

    // 1. OPTIMISTIC SKELETON TRANSITION: Instantly show processing screen to isolate high latency
    setStatus("SUBMITTING");
    setStep(7.5); // Custom optimistic processing view inside IntakeCard
    localStorage.removeItem("manajer_lead_intake"); // Pre-emptively clear cache

    // Create a 800ms visual buffer to ensure smooth telemetry loading animations
    const animationPromise = new Promise((resolve) => setTimeout(resolve, 800));

    // 2. BACKGROUND TELEMETRY TRANSMISSION (Executed asynchronously via server action)
    const dbPromise = submitLeadForm(formData);

    Promise.all([animationPromise, dbPromise])
      .then(([_, result]) => {
        if (!result.success) {
          throw new Error(result.error || "Failed to establish database telemetry handshake.");
        }
        console.log("[Telemetry Transmit Background Ingestion Complete]");
        try {
          localStorage.setItem("manajer_lead_submitted", "true");
        } catch (_) {}
        setStatus("SUCCESS");
        setStep(8);
      })
      .catch((err: any) => {
        console.error("[Telemetry Transmit Background Failure - Performing Rollback]:", err);
        
        // 3. GRACEFUL ROLLBACK: Restore user states, return to form, and display red-alert telemetry banner
        setStatus("ERROR");
        setStep(prevStep);
        setErrorMessage(err.message || "An unknown transmission discrepancy occurred. Please check network connection and try again.");

        // Restore local storage persistence so they don't lose data
        try {
          localStorage.setItem(
            "manajer_lead_intake",
            JSON.stringify({ formData: prevFormData, step: prevStep })
          );
        } catch (_) {}
      });
  };

  const progressPercentage = step <= 7 ? (step / 7) * 100 : 100;

  const isCurrentStepValid = () => {
    if (step === 1) return formData.business_name.trim() !== "";
    if (step === 2) return formData.category.trim() !== "";
    if (step === 3) return formData.region.trim() !== "";
    if (step === 4) return formData.current_system.trim() !== "";
    if (step === 5) return formData.monthly_volume.trim() !== "";
    if (step === 6) return formData.whatsapp_num.trim() !== "";
    if (step === 7) return formData.email.trim() !== "";
    return true;
  };

  // Reusable Input Class Generator — clean enterprise style
  const getInputClassName = () => {
    return `w-full max-w-2xl h-12 md:h-14 rounded-xl px-4 md:px-5 font-sans text-sm text-white outline-none transition-all duration-200 placeholder-white/25 ${
      inputError 
        ? "border-red-500/40 bg-red-500/[0.03] animate-shake border"
        : "bg-white/[0.04] border border-white/10 focus:border-white/30 focus:bg-white/[0.06]"
    }`;
  };

  // Preset Option Button — clean enterprise style, selected = white/8 border
  const getPresetClassName = (fieldName: keyof LeadPayload, optionValue: string) => {
    const isSelected = formData[fieldName] === optionValue;
    return `w-full h-11 px-4 rounded-xl border text-[11px] font-medium tracking-wide transition-all duration-200 flex items-center justify-between text-left select-none outline-none ${
      isSelected
        ? "bg-white/[0.08] border-white/30 text-white"
        : "bg-white/[0.02] border border-white/8 hover:border-white/20 hover:bg-white/[0.04] text-white/50 hover:text-white/80"
    }`;
  };

  return (
    <div
      className="w-full max-w-2xl rounded-2xl relative transition-all duration-500 ease-in-out cursor-default p-6 md:p-8"
      style={{
        background: "rgba(10, 15, 30, 0.60)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderTop: "1px solid rgba(255, 255, 255, 0.13)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      {/* ── IMMERSIVE WORKSPACE CACHE HYDRATION ALERT ── */}
      {showHydratedAlert && (
        <div className="absolute top-[3px] left-0 w-full bg-[#081225]/95 border-b border-[#00F2FE]/25 py-2 px-4 text-[9px] font-mono tracking-[0.2em] font-bold text-[#00F2FE] flex items-center justify-between uppercase select-none animate-in slide-in-from-top-2 duration-300 z-20">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] animate-ping" />
            <span>FILL HERE</span>
          </div>
          <button 
            type="button" 
            onClick={() => setShowHydratedAlert(false)}
            className="text-white/40 hover:text-white font-mono text-[9px] focus:outline-none"
          >
            [DISMISS]
          </button>
        </div>
      )}
      
      {/* PROGRESS BAR — inside card, clipped by overflow:hidden */}
      {step <= 7 && (
        <div className="absolute top-0 left-0 w-full h-[3px] bg-white/[0.06] z-10">
          <div 
            className="h-full bg-white transition-all duration-500 ease-in-out"
            style={{ 
              width: `${progressPercentage}%`,
              boxShadow: "0 0 8px rgba(255,255,255,0.6), 0 0 2px rgba(255,255,255,0.9)"
            }}
          />
        </div>
      )}

      {/* Main Interactive Flow */}
      <form onSubmit={(e) => e.preventDefault()} className="relative flex flex-col justify-between">
        
        {/* STEP 1: IDENTITY */}
        {step === 1 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  Enter your business or brand name.
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  Let's start with your company or brand name.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
                title="System Onboarding Telemetry Guide"
              >
                ?
              </button>
            </div>

            <input 
              type="text" 
              name="business_name"
              value={formData.business_name}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Enter") nextStep(); }}
              className={getInputClassName()}
              placeholder="e.g., MANAJER.PK, Acme Systems, Alpha Corp..."
              autoFocus
              autoComplete="off"
            />
          </div>
        )}

        {/* STEP 2: CATEGORY / SECTOR PRESETS */}
        {step === 2 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  What is your industry or sector?
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  Select the industry sector that best fits your business.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
              >
                ?
              </button>
            </div>

            {!customCategory ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CATEGORY_PRESETS.map((preset) => {
                  const isSelected = formData.category === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect("category", preset)}
                      className={getPresetClassName("category", preset)}
                    >
                      <span>{preset}</span>
                      <span className={`text-[10px] flex items-center ${isSelected ? "text-white" : "text-white/20"}`}>
                        {isSelected ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                        )}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePresetSelect("category", "", true)}
                  className={`w-full h-11 px-4 rounded-xl border text-[11px] font-medium tracking-wide transition-all duration-200 flex items-center justify-between text-left select-none outline-none ${
                    customCategory
                      ? "bg-white/[0.08] border-white/30 text-white"
                      : "bg-white/[0.02] border border-white/8 hover:border-white/20 hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                  }`}
                >
                  <span>Other / Custom Sector</span>
                  <span className={`text-[10px] flex items-center ${customCategory ? "text-white" : "text-white/20"}`}>
                    {customCategory ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                    )}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="text" 
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter") nextStep(); }}
                  className={getInputClassName()}
                  placeholder="e.g., Apparel Retail, EdTech SaaS, Healthcare..."
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => handlePresetSelect("category", "", false)}
                  className="self-start text-[10px] font-medium text-white/30 hover:text-white/60 tracking-wide transition-colors py-1.5 focus:outline-none"
                >
                  ← Back to options
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: REGION PRESETS */}
        {step === 3 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  Where do you operate?
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  Tell us where your target customers or primary operations are.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
              >
                ?
              </button>
            </div>

            {!customRegion ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REGION_PRESETS.map((preset) => {
                  const isSelected = formData.region === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect("region", preset)}
                      className={getPresetClassName("region", preset)}
                    >
                      <span>{preset}</span>
                      <span className={`text-[10px] flex items-center ${isSelected ? "text-white" : "text-white/20"}`}>
                        {isSelected ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                        )}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePresetSelect("region", "", true)}
                  className={`w-full h-11 px-4 rounded-xl border text-[11px] font-medium tracking-wide transition-all duration-200 flex items-center justify-between text-left select-none outline-none ${
                    customRegion
                      ? "bg-white/[0.08] border-white/30 text-white"
                      : "bg-white/[0.02] border border-white/8 hover:border-white/20 hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                  }`}
                >
                  <span>Other / Custom Region</span>
                  <span className={`text-[10px] flex items-center ${customRegion ? "text-white" : "text-white/20"}`}>
                    {customRegion ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                    )}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="text" 
                  name="region"
                  value={formData.region}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter") nextStep(); }}
                  className={getInputClassName()}
                  placeholder="e.g., UAE, Asia Pacific, European Union..."
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => handlePresetSelect("region", "", false)}
                  className="self-start text-[10px] font-medium text-white/30 hover:text-white/60 tracking-wide transition-colors py-1.5 focus:outline-none"
                >
                  ← Back to options
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: CURRENT SYSTEM PRESETS */}
        {step === 4 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  What system do you use right now?
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  Tell us about your current tools so we can plan a smooth transition.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
              >
                ?
              </button>
            </div>

            {!customSystem ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SYSTEM_PRESETS.map((preset) => {
                  const isSelected = formData.current_system === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect("current_system", preset)}
                      className={getPresetClassName("current_system", preset)}
                    >
                      <span>{preset}</span>
                      <span className={`text-[10px] flex items-center ${isSelected ? "text-white" : "text-white/20"}`}>
                        {isSelected ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                        )}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handlePresetSelect("current_system", "", true)}
                  className={`w-full h-11 px-4 rounded-xl border text-[11px] font-medium tracking-wide transition-all duration-200 flex items-center justify-between text-left select-none outline-none ${
                    customSystem
                      ? "bg-white/[0.08] border-white/30 text-white"
                      : "bg-white/[0.02] border border-white/8 hover:border-white/20 hover:bg-white/[0.04] text-white/50 hover:text-white/80"
                  }`}
                >
                  <span>Other / Custom Software</span>
                  <span className={`text-[10px] flex items-center ${customSystem ? "text-white" : "text-white/20"}`}>
                    {customSystem ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                    )}
                  </span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-300">
                <input 
                  type="text" 
                  name="current_system"
                  value={formData.current_system}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === "Enter") nextStep(); }}
                  className={getInputClassName()}
                  placeholder="e.g., Odoo, Custom FileMaker, SAP..."
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => handlePresetSelect("current_system", "", false)}
                  className="self-start text-[10px] font-medium text-white/30 hover:text-white/60 tracking-wide transition-colors py-1.5 focus:outline-none"
                >
                  ← Back to options
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: MONTHLY VOLUME PRESETS */}
        {step === 5 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  How many monthly orders or events do you process?
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  This helps us understand the monthly volume of your business transactions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
              >
                ?
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {VOLUME_PRESETS.map((preset) => {
                const isSelected = formData.monthly_volume === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetSelect("monthly_volume", preset)}
                    className={getPresetClassName("monthly_volume", preset)}
                  >
                    <span>{preset}</span>
                    <span className={`text-[10px] flex items-center ${isSelected ? "text-white" : "text-white/20"}`}>
                      {isSelected ? (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 6: WHATSAPP */}
        {step === 6 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  What is your WhatsApp number?
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  We will use this to get in touch with you quickly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
              >
                ?
              </button>
            </div>

            <input 
              type="tel" 
              name="whatsapp_num"
              value={formData.whatsapp_num}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === "Enter") nextStep(); }}
              className={getInputClassName()}
              placeholder="e.g., +92 300 1234567 · +1 555 0199 · +44 7911 123456"
              autoFocus
              autoComplete="tel"
            />
          </div>
        )}

        {/* STEP 7: EMAIL & SUBMISSION */}
        {step === 7 && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-300">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 text-left">
                <h3 className="text-lg font-bold tracking-tight text-white/90">
                  What is your operational email address?
                </h3>
                <p className="text-white/40 text-[10px] font-mono tracking-wider mb-1 uppercase">
                  We will send your setup details, reports, and onboarding plans here.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="w-9 h-9 rounded-full border flex items-center justify-center text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 focus:outline-none bg-white/[0.04] border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/[0.08] active:scale-95"
                aria-label="Toggle Technical Onboarding Help"
              >
                ?
              </button>
            </div>

            <div className="relative w-full">
              <input 
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter") submitApplication(e); }}
                readOnly={!!loggedInEmail}
                className={`${getInputClassName()} ${
                  loggedInEmail 
                    ? "border-emerald-500/30 bg-emerald-950/[0.04] text-emerald-300 focus:border-emerald-500/50 focus:ring-emerald-500/20 pr-32" 
                    : ""
                }`}
                placeholder="e.g., systems@manajer.pk, admin@acme.com..."
                autoFocus={!loggedInEmail}
                autoComplete="off"
                required
              />
              {loggedInEmail && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider select-none animate-in fade-in duration-300">
                  ✓ Verified Client
                </div>
              )}
            </div>
            {status === "ERROR" && (
              <div className="mt-2 p-4 rounded-md border border-white/15 bg-white/5 text-white/80 font-mono text-xs flex flex-col gap-1 leading-relaxed text-left animate-shake">
                <span className="font-bold text-red-400">⚡ SUBMISSION ERROR</span>
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 7.5: OPTIMISTIC SKELETON LOADER SCREEN ── */}
        {step === 7.5 && (
          <div className="flex flex-col gap-5 py-4 animate-in fade-in duration-300 text-left">
            <div className="flex flex-col gap-1.5 select-none">
              <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-[#00F2FE] uppercase animate-pulse">
                SAVING YOUR PREFERENCES
              </span>
              <h3 className="text-lg font-bold tracking-tight text-white/95 uppercase">
                Sending project request details...
              </h3>
            </div>
            
            {/* Pulsing Skeleton Block Rows */}
            <div className="flex flex-col gap-3 w-full">
              <div className="h-6 bg-white/5 border border-white/10 rounded-lg animate-pulse w-3/4 flex items-center px-3 font-mono text-[9px] text-white/40">
                &gt; Connecting to database...
              </div>
              <div className="h-6 bg-white/5 border border-white/10 rounded-lg animate-pulse w-full flex items-center px-3 font-mono text-[9px] text-[#00F2FE]/60">
                &gt; Saving responses...
              </div>
              <div className="h-6 bg-white/5 border border-white/10 rounded-lg animate-pulse w-5/6 flex items-center px-3 font-mono text-[9px] text-white/40">
                &gt; Completing submission...
              </div>
            </div>

            {/* Minimalist monochrome spinner indicator */}
            <div className="flex items-center gap-3 mt-4 text-[10px] font-mono tracking-widest text-white/40 uppercase">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
              <span>Synchronizing remote endpoints...</span>
            </div>
          </div>
        )}

        {/* SUCCESS COMPLETED STATE */}
        {status === "SUCCESS" && (
          <div className="flex flex-col items-start gap-4 py-4 animate-in fade-in duration-500 text-left">
            <div className="w-12 h-12 rounded-md bg-white/5 border border-white/20 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(0,242,254,0.05)]">
              <span className="text-xl text-[#00F2FE]">✓</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-white">Application Submitted</h3>
            <p className="text-white/60 font-sans text-base max-w-lg leading-relaxed">
              Your details have been saved successfully. **We will contact you soon!**
            </p>
          </div>
        )}

        {/* Action Controls */}
        {step <= 7 && (
          <div className="grid grid-cols-2 gap-3 mt-7 border-t border-white/[0.06] pt-5 w-full">
            <button 
              type="button"
              onClick={prevStep}
              disabled={step === 1 || status === "SUBMITTING"}
              className={`h-[52px] px-5 rounded-[14px] text-[13px] font-semibold whitespace-nowrap transition-all duration-300 ease-out flex items-center justify-center gap-2 border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/22 active:scale-[0.97] active:bg-white/[0.06] text-white/55 hover:text-white/90 ${
                step === 1 
                  ? "opacity-0 pointer-events-none" 
                  : "disabled:opacity-20 disabled:pointer-events-none"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            
            {step < 7 ? (
              <button 
                type="button"
                onClick={nextStep}
                className="h-[52px] bg-white hover:bg-white/93 active:bg-white/85 active:scale-[0.97] text-[#040712] px-5 rounded-[14px] text-[13px] font-semibold whitespace-nowrap transition-all duration-300 ease-out flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(255,255,255,0.12)]"
              >
                Continue
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button 
                type="submit"
                onClick={submitApplication}
                disabled={status === "SUBMITTING"}
                className="h-[52px] bg-white hover:bg-white/93 active:bg-white/85 active:scale-[0.97] text-[#040712] disabled:bg-white/15 disabled:text-white/25 px-5 rounded-[14px] text-[13px] font-semibold whitespace-nowrap transition-all duration-300 ease-out disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_2px_12px_rgba(255,255,255,0.12)] disabled:shadow-none"
              >
                {status === "SUBMITTING" ? (
                  <>
                    <div className="w-4 h-4 border-[1.5px] border-[#040712]/20 border-t-[#040712]/70 rounded-full animate-spin shrink-0" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </form>

      {/* ── IMMERSIVE CIRCULAR REVEAL HELP OVERLAY ── */}
      <div 
        onClick={() => setShowHelp(false)}
        className="absolute inset-0 z-50 flex items-center justify-center p-4 select-none"
        style={{
          background: "linear-gradient(135deg, rgba(8, 12, 24, 0.98), rgba(4, 6, 12, 0.99))",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          clipPath: showHelp 
            ? "circle(150% at calc(100% - 44px) 44px)" 
            : "circle(0% at calc(100% - 44px) 44px)",
          pointerEvents: showHelp ? "auto" : "none",
          transition: "clip-path 0.75s cubic-bezier(0.19, 1, 0.22, 1)",
        }}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          ref={helpContainerRef}
          className="w-full h-full flex flex-col justify-between pt-4 pb-3 px-5 rounded-xl border border-[#00F2FE]/15 overflow-y-auto scrollbar-none"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5 select-none">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] opacity-80" />
              <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-[#00F2FE] uppercase">
                HOW IT WORKS
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setShowHelp(false)}
              className="border border-white/10 hover:border-[#00F2FE]/45 hover:text-[#00F2FE] bg-white/5 hover:bg-[#00F2FE]/5 text-white/50 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none"
              aria-label="Close Guide"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-3 my-2.5 max-w-md mx-auto text-left w-full select-none">
            <div className="flex gap-3 items-start border-b border-white/5 pb-2.5">
              <div className="w-7 h-7 rounded-lg border border-[#00F2FE]/30 bg-[#00F2FE]/10 flex items-center justify-center text-[10.5px] text-[#00F2FE] shrink-0 font-bold font-mono">
                01
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11.5px] font-bold text-white uppercase tracking-wide font-mono">Fill the Form</span>
                <span className="text-white/40 text-[9.5px] leading-normal font-sans">Tell us about your business and what you need.</span>
              </div>
            </div>
            <div className="flex gap-3 items-start border-b border-white/5 pb-2.5">
              <div className="w-7 h-7 rounded-lg border border-[#00F2FE]/20 bg-[#00F2FE]/5 flex items-center justify-center text-[10.5px] text-[#00F2FE]/80 shrink-0 font-bold font-mono">
                02
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11.5px] font-bold text-white uppercase tracking-wide font-mono">We Review It</span>
                <span className="text-white/40 text-[9.5px] leading-normal font-sans">Usually within 24 hours. We'll reach out on WhatsApp.</span>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-lg border border-[#00F2FE]/20 bg-[#00F2FE]/5 flex items-center justify-center text-[10.5px] text-[#00F2FE]/80 shrink-0 font-bold font-mono">
                03
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11.5px] font-bold text-white uppercase tracking-wide font-mono">We Build It</span>
                <span className="text-white/40 text-[9.5px] leading-normal font-sans">Custom software handed over and fully working.</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-2.5 text-center select-none">
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-[0.25em]">
              MANAJER SOFTWARE AGENCY
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
