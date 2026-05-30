"use client";

import { useState, useEffect } from "react";
import { supabase as supabaseClient } from "@/lib/supabase";
import { md5 } from "@/lib/hash";

type ControlTowerProps = {
  isOpen: boolean;
  onClose: () => void;
  authEmail?: string | null;
  authName?: string | null;
};

type SectionKey = "pipeline" | "about" | "process" | "reviews" | null;

const getAvatarGradient = (name: string) => {
  const gradients = [
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-indigo-500",
    "from-emerald-500 to-teal-500",
    "from-amber-500 to-orange-500",
    "from-pink-500 to-rose-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
};

export default function ControlTower({ isOpen, onClose, authEmail, authName }: ControlTowerProps) {
  const [expandedSection, setExpandedSection] = useState<SectionKey>(null);
  const [memberLeads, setMemberLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [approvedReviews, setApprovedReviews] = useState<any[]>([]);
  const [currentReview, setCurrentReview] = useState(0);
  const [sidebarImgError, setSidebarImgError] = useState(false);

  useEffect(() => {
    setSidebarImgError(false);
  }, [currentReview, approvedReviews[currentReview]?.email]);

  const toggleSection = (section: SectionKey) =>
    setExpandedSection(expandedSection === section ? null : section);

  // Fetch this member's own lead submissions
  useEffect(() => {
    if (!isOpen || !authEmail) return;
    setLoadingLeads(true);
    supabaseClient
      .from("leads")
      .select("id, business_name, category, current_system, status, created_at")
      .eq("email", authEmail)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        setLoadingLeads(false);
        if (!error && data) setMemberLeads(data);
      });
  }, [isOpen, authEmail]);

  // Fetch approved reviews
  useEffect(() => {
    if (!isOpen) return;
    supabaseClient
      .from("reviews")
      .select("id, name, role, feedback, rating, email, avatar_url, created_at")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setApprovedReviews(data);
      });
  }, [isOpen]);

  const prevReview = () =>
    setCurrentReview(prev => prev === 0 ? approvedReviews.length - 1 : prev - 1);
  const nextReview = () =>
    setCurrentReview(prev => prev === approvedReviews.length - 1 ? 0 : prev + 1);

  return (
    <aside
      className={`w-full max-w-[320px] sm:max-w-[352px] h-screen fixed left-0 top-0 border-r border-[#00F2FE]/15 flex flex-col z-50 transition-all duration-500 ease-in-out shadow-[0_0_80px_rgba(0,0,0,0.9)] ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        background: "linear-gradient(to bottom, rgba(10, 20, 42, 0.82), rgba(6, 12, 24, 0.85), rgba(3, 6, 12, 0.90))",
        backdropFilter: "blur(14px) saturate(210%)",
        WebkitBackdropFilter: "blur(14px) saturate(210%)",
      }}
    >

      {/* ── HEADER COMPARTMENT ── */}
      <div className="w-full px-6 pt-7 select-none shrink-0 border-b border-white/5 pb-5">
        <div className="flex items-center justify-between w-full mb-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F2FE] opacity-80" />
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-[#00F2FE] uppercase">
              Client Portal
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md border border-[#00F2FE]/15 hover:border-[#00F2FE]/45 hover:text-[#00F2FE] bg-[#060C1C]/45 hover:bg-[#00F2FE]/5 text-white/50 flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none apple-btn-interactive"
            aria-label="Close"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* LOGO BANNER WITH GLOW */}
        <div className="w-full flex justify-center py-4 overflow-hidden relative select-none">
          {/* Radial glow behind logo */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-16 rounded-full pointer-events-none opacity-30 mix-blend-screen"
            style={{
              background: "radial-gradient(circle, rgba(0, 242, 254, 0.20) 0%, rgba(0, 242, 254, 0.05) 50%, transparent 80%)",
              filter: "blur(18px)",
              zIndex: 0,
            }}
          />
          <img
            src="/logo-banner.png?v=5"
            alt="MANAJER"
            className="w-[92%] h-auto object-contain block filter drop-shadow-[0_0_25px_rgba(0,242,254,0.4)] transition-transform duration-500 hover:scale-[1.04] relative"
            style={{ transform: "scale(1.75)", transformOrigin: "center", zIndex: 1 }}
            loading="eager"
          />
        </div>
      </div>

      {/* ── ACCORDION STACK ── */}
      <div className="flex-1 w-full px-6 pt-3 overflow-y-auto scrollbar-none flex flex-col justify-start gap-4">
        <div className="w-full flex flex-col gap-4">

          {/* ACCORDION 1: MY APPLICATION STATUS */}
          <Accordion
            id="pipeline"
            label="My Application"
            active={expandedSection === "pipeline"}
            onToggle={() => toggleSection("pipeline")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />}
          >
            {!authEmail ? (
              <div className="py-6 flex flex-col items-center text-center gap-2">
                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Sign In Required</span>
                <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                  Sign in to track the status of your application.
                </p>
              </div>
            ) : loadingLeads ? (
              <div className="py-6 text-center text-[10px] font-mono text-neutral-500 animate-pulse">
                Loading your application...
              </div>
            ) : memberLeads.length === 0 ? (
              <div className="py-6 flex flex-col items-center text-center gap-2">
                <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-wider">Nothing yet</span>
                <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                  You haven't submitted an application yet. Fill out the intake form to get started.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-1">
                {memberLeads.map((lead) => (
                  <div key={lead.id} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex flex-col gap-2 text-[9.5px]">
                    <div className="flex justify-between items-start">
                      <span className="text-white font-bold uppercase">{lead.business_name}</span>
                      <span className={`text-[8px] px-2 py-0.5 rounded font-bold ${
                        lead.status === "DEPLOYED"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {lead.status === "DEPLOYED" ? "Active" : "Under Review"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 text-white/40 font-sans">
                      <div>Industry: <span className="text-white/70">{lead.category}</span></div>
                      <div>Current system: <span className="text-white/70">{lead.current_system}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          {/* ACCORDION 2: WHO WE ARE */}
          <Accordion
            id="about"
            label="Who We Are"
            active={expandedSection === "about"}
            onToggle={() => toggleSection("about")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
          >
            <span className="text-[8px] font-bold text-[#00F2FE] tracking-[0.2em] font-mono uppercase block mb-1.5">
              SOFTWARE FOR PAKISTANI BUSINESSES
            </span>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono">
              MANAJER Software Labs
            </h4>
            <p className="text-[11px] text-white/50 leading-relaxed mb-4">
              We help businesses stop running their operations on WhatsApp and Excel — and move to proper software that actually scales with them.
            </p>
            <div className="flex flex-col gap-2 font-mono text-[9px] text-white/40">
              {["Custom business software", "Database & cloud setup", "Automation & workflow systems"].map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <svg className="w-3.5 h-3.5 text-[#00F2FE] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-white/60">{item}</span>
                </div>
              ))}
            </div>
          </Accordion>

          {/* ACCORDION 3: WHAT HAPPENS NEXT */}
          <Accordion
            id="process"
            label="What Happens Next?"
            active={expandedSection === "process"}
            onToggle={() => toggleSection("process")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />}
          >
            <span className="text-[8px] font-bold text-[#00F2FE] tracking-[0.2em] font-mono uppercase block mb-3.5">
              HOW IT WORKS
            </span>
            <div className="flex flex-col gap-4 font-mono text-[10px]">
              {[
                { n: "01", title: "Fill the Form", desc: "Tell us about your business and what you need." },
                { n: "02", title: "We Review It", desc: "Usually within 24 hours. We'll reach out on WhatsApp." },
                { n: "03", title: "We Build It", desc: "Custom software handed over and fully working." },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-3.5 items-start">
                  <div className="w-5 h-5 rounded-md border border-[#00F2FE]/30 bg-[#00F2FE]/10 flex items-center justify-center text-[9px] text-[#00F2FE] shrink-0 font-bold">
                    {n}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-white font-bold uppercase text-[10px]">{title}</span>
                    <span className="text-white/40 text-[9px] leading-normal font-sans">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </Accordion>

          {/* ACCORDION 4: CLIENT REVIEWS */}
          <Accordion
            id="reviews"
            label="Client Reviews"
            active={expandedSection === "reviews"}
            onToggle={() => toggleSection("reviews")}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
          >
            {approvedReviews.length === 0 ? (
              <div className="py-6 flex flex-col items-center text-center gap-1.5">
                <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                  No reviews yet. Be the first to share your experience!
                </p>
              </div>
            ) : (
              <div>
                {/* Stars */}
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: approvedReviews[currentReview]?.rating || 5 }).map((_, i) => (
                    <svg key={i} className="w-3 h-3 fill-amber-400 text-amber-400" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                  ))}
                </div>

                <div className="min-h-[70px] flex flex-col justify-between">
                  <p className="text-[11px] text-white/70 italic leading-relaxed mb-4">
                    "{approvedReviews[currentReview]?.feedback}"
                  </p>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3.5">
                    {/* Author */}
                    <div className="flex items-center gap-2">
                      {(() => {
                        const r = approvedReviews[currentReview];
                        const hash = r?.email ? md5(r.email.trim().toLowerCase()) : "";
                        const src = r?.avatar_url || (hash ? `https://www.gravatar.com/avatar/${hash}?d=404` : null);
                        return src && !sidebarImgError ? (
                          <img
                            src={src}
                            alt={r?.name || ""}
                            onError={() => setSidebarImgError(true)}
                            className="w-6 h-6 rounded-full border border-white/10 shrink-0 object-cover"
                          />
                        ) : (
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-tr ${getAvatarGradient(r?.name || "")} border border-white/10 flex items-center justify-center font-mono font-extrabold text-[8.5px] text-white shrink-0`}>
                            {(r?.name || "?").slice(0, 2)}
                          </div>
                        );
                      })()}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white font-mono">
                          {approvedReviews[currentReview]?.name}
                        </span>
                        <span className="text-[8.5px] text-[#00F2FE] font-mono tracking-wider">
                          {approvedReviews[currentReview]?.role}
                        </span>
                      </div>
                    </div>

                    {/* Nav arrows */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={prevReview}
                        className="w-6 h-6 rounded border border-[#00F2FE]/15 bg-[#060C1C]/45 hover:bg-[#00F2FE]/10 hover:border-[#00F2FE]/45 text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none apple-btn-interactive"
                      >
                        <svg className="w-2.5 h-2.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={nextReview}
                        className="w-6 h-6 rounded border border-[#00F2FE]/15 bg-[#060C1C]/45 hover:bg-[#00F2FE]/10 hover:border-[#00F2FE]/45 text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none apple-btn-interactive"
                      >
                        <svg className="w-2.5 h-2.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Dot indicators */}
                  {approvedReviews.length > 1 && (
                    <div className="flex gap-1 justify-center mt-3">
                      {approvedReviews.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => { setSidebarImgError(false); setCurrentReview(i); }}
                          className={`rounded-full transition-all duration-200 focus:outline-none ${
                            i === currentReview
                              ? "w-3 h-1.5 bg-[#00F2FE]"
                              : "w-1.5 h-1.5 bg-white/15 hover:bg-white/30"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Accordion>

        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="flex flex-col gap-1 select-none w-full px-6 pb-6 shrink-0 border-t border-white/5 pt-5 text-center">
        <div className="text-[9.5px] font-bold text-white/20 tracking-[0.2em] uppercase font-mono">
          © {new Date().getFullYear()} MANAJER.PK
        </div>
        <div className="text-[8.5px] font-medium text-white/10 tracking-wider uppercase font-mono">
          Built for Pakistan
        </div>
      </div>
    </aside>
  );
}

// ── REUSABLE ACCORDION ────────────────────────────────────────────────────────
function Accordion({
  id, label, icon, active, onToggle, children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border rounded-xl overflow-hidden transition-all duration-500 cursor-pointer apple-card-interactive ${
        active
          ? "border-[#00F2FE]/45 bg-[#060C1C]/65"
          : "border-[#00F2FE]/12 bg-[#060C1C]/32"
      }`}
      style={active ? { boxShadow: "0 0 25px rgba(0, 242, 254, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)" } : undefined}
    >
      <button
        onClick={onToggle}
        className="w-full py-4 px-4 flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-wider text-white select-none text-left focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <svg className={`w-4 h-4 transition-colors duration-300 ${active ? "text-[#00F2FE]" : "text-white/60"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {icon}
          </svg>
          <span className={active ? "text-[#00F2FE]" : "text-white/90"}>{label}</span>
        </div>
        <span className={`transition-all duration-300 ${active ? "text-[#00F2FE] rotate-180" : "text-white/40"}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
        active ? "max-h-[380px] opacity-100 border-t border-[#00F2FE]/15" : "max-h-0 opacity-0 pointer-events-none"
      }`}>
        <div className="px-4 pb-4 pt-3.5 select-none text-left cursor-default">
          {children}
        </div>
      </div>
    </div>
  );
}
