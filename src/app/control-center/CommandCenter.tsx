"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { md5 } from "@/lib/hash";
import {
  approveReview, deleteReview, deleteLead, deploySystem, signOutAdmin,
  getAdminEmails, addAdminEmail, removeAdminEmail,
} from "./actions";

type Review = {
  id: string; name: string; role: string; feedback: string;
  rating: number; is_approved: boolean; created_at: string;
  email?: string; avatar_url?: string;
};
type Lead = {
  id: string; business_name: string; category: string; region: string;
  current_system: string; monthly_volume: string; whatsapp_num: string;
  email: string; status: string; created_at: string;
};
type Tab = "leads" | "clients" | "reviews" | "access";

export default function CommandCenter({
  initialReviews, initialLeads, adminEmail, adminName, adminAvatarUrl,
}: { 
  initialReviews: Review[]; 
  initialLeads: Lead[]; 
  adminEmail: string;
  adminName?: string | null;
  adminAvatarUrl?: string | null;
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [tab, setTab] = useState<Tab>("leads");
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [busyReview, setBusyReview] = useState<string | null>(null);
  const [busyLead, setBusyLead] = useState<string | null>(null);
  const [adminImgError, setAdminImgError] = useState(false);

  const [adminEmails, setAdminEmails] = useState<string[]>([adminEmail]);
  const [newEmail, setNewEmail] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMsg, setAdminMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const newLeads = leads.filter(l => l.status === "PENDING" || !l.status);
  const clients = leads.filter(l => l.status === "DEPLOYED");
  const pending = reviews.filter(r => !r.is_approved);
  const live = reviews.filter(r => r.is_approved);

  const loadAdmins = useCallback(async () => {
    const r = await getAdminEmails();
    if (r.success) setAdminEmails(r.emails);
  }, []);

  useEffect(() => { if (tab === "access") loadAdmins(); }, [tab, loadAdmins]);

  const handleApprove = async (id: string) => {
    if (busyReview) return;
    setBusyReview(id);
    setReviews(p => p.map(r => r.id === id ? { ...r, is_approved: true } : r));
    const res = await approveReview(id);
    setBusyReview(null);
    if (!res.success) setReviews(p => p.map(r => r.id === id ? { ...r, is_approved: false } : r));
  };

  const handleDeleteReview = async (id: string, name: string) => {
    if (busyReview || !confirm(`Delete review from ${name}?`)) return;
    setBusyReview(id);
    const snap = reviews.find(r => r.id === id);
    setReviews(p => p.filter(r => r.id !== id));
    const res = await deleteReview(id);
    setBusyReview(null);
    if (!res.success && snap) setReviews(p => [...p, snap].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const handleMarkClient = async (id: string, name: string) => {
    if (busyLead || !confirm(`Mark "${name}" as a client?`)) return;
    setBusyLead(id);
    setLeads(p => p.map(l => l.id === id ? { ...l, status: "DEPLOYED" } : l));
    const res = await deploySystem(id);
    setBusyLead(null);
    if (!res.success) setLeads(p => p.map(l => l.id === id ? { ...l, status: "PENDING" } : l));
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (busyLead || !confirm(`Permanently delete "${name}"?`)) return;
    setBusyLead(id);
    const snap = leads.find(l => l.id === id);
    setLeads(p => p.filter(l => l.id !== id));
    const res = await deleteLead(id);
    setBusyLead(null);
    if (!res.success && snap) setLeads(p => [...p, snap].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const res = await signOutAdmin();
    if (res.success) router.push("/");
    else { setSigningOut(false); setShowSignOut(false); }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMsg(null);
    setAdminBusy(true);
    const res = await addAdminEmail(newEmail.trim());
    setAdminBusy(false);
    if (res.success) { setAdminMsg({ type: "ok", text: `${newEmail.trim()} added.` }); setNewEmail(""); loadAdmins(); }
    else setAdminMsg({ type: "err", text: res.error });
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!confirm(`Remove ${email}?`)) return;
    setAdminMsg(null);
    setAdminBusy(true);
    const res = await removeAdminEmail(email);
    setAdminBusy(false);
    if (res.success) { setAdminMsg({ type: "ok", text: `${email} removed.` }); loadAdmins(); }
    else setAdminMsg({ type: "err", text: res.error });
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "leads", label: "New Leads", badge: newLeads.length },
    { id: "clients", label: "Clients", badge: clients.length },
    { id: "reviews", label: "Reviews", badge: pending.length || undefined },
    { id: "access", label: "Admin Access" },
  ];

  return (
    <div className="min-h-screen text-white font-sans antialiased relative overflow-hidden" style={{ background: "#080C16" }}>

      {/* Modern atmospheric depth — deep premium slate gradients with cool atmospheric light rings */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at 50% -10%, rgba(37,99,235,0.18) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(6,182,212,0.06) 0%, transparent 50%)"
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(circle at 10% 40%, rgba(99,102,241,0.05) 0%, transparent 40%)"
      }} />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] px-4 md:px-10 h-14 md:h-16 flex items-center justify-between gap-4"
        style={{ background: "rgba(8,12,22,0.85)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={() => router.push("/")}
            className="flex items-center gap-1.5 h-7.5 px-3 sm:h-8 sm:px-3.5 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-[10px] sm:text-[11px] font-semibold text-neutral-400 hover:text-white transition-all focus:outline-none cursor-pointer apple-btn-interactive">
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back<span className="hidden sm:inline"> to Site</span>
          </button>
          <div className="hidden sm:block h-4 w-px bg-white/10" />
          <span className="hidden sm:inline text-[13px] font-bold text-white tracking-wider uppercase font-mono text-[#00F2FE]">Command Center</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 h-8.5 px-3 rounded-full border border-white/[0.08] bg-white/[0.02] select-none shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            {(() => {
              const avatarSrc = adminAvatarUrl;
              return avatarSrc && !adminImgError ? (
                <img
                  src={avatarSrc}
                  alt={adminName || ""}
                  onError={() => setAdminImgError(true)}
                  className="w-5.5 h-5.5 rounded-full border border-white/10 shrink-0 object-cover"
                />
              ) : (
                <div className="w-5.5 h-5.5 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00F2FE] border border-white/10 flex items-center justify-center font-mono font-extrabold text-[8.5px] text-white uppercase shrink-0">
                  {adminName ? adminName.slice(0, 2) : adminEmail.slice(0, 2)}
                </div>
              );
            })()}
            <div className="flex flex-col text-left max-w-[140px] shrink-0 justify-center">
              <span className="text-[9.5px] font-bold text-white tracking-wide truncate leading-tight uppercase font-mono">
                {adminName || adminEmail.split("@")[0]}
              </span>
              <span className="text-[8.5px] font-mono text-neutral-400 truncate leading-none mt-0.5">
                {adminEmail}
              </span>
            </div>
          </div>
          <button onClick={() => setShowSignOut(true)} disabled={signingOut}
            className="h-7.5 px-3 sm:h-8 sm:px-4 rounded-full border border-white/10 bg-white/[0.04] hover:border-red-500/30 hover:bg-red-500/[0.08] text-[10.1px] sm:text-[11px] font-semibold text-neutral-400 hover:text-red-400 transition-all focus:outline-none disabled:opacity-40 cursor-pointer">
            {signingOut ? "..." : "Sign Out"}
          </button>
        </div>
      </header>

      <div className="px-4.5 md:px-10 py-6 md:py-10 max-w-6xl mx-auto relative z-10">

        {/* ── STAT CARDS ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 md:gap-4 mb-8 md:mb-10">
          {[
            { label: "New Leads", value: newLeads.length, sub: "awaiting review", border: "border-l-[3px] border-blue-500" },
            { label: "Active Clients", value: clients.length, sub: "in your roster", border: "border-l-[3px] border-emerald-500" },
            { label: "Pending Reviews", value: pending.length, sub: "need your approval", border: "border-l-[3px] border-amber-500" },
            { label: "Live Reviews", value: live.length, sub: "shown on site", border: "border-l-[3px] border-indigo-500" },
          ].map(s => (
            <div key={s.label}
              className={`rounded-xl border border-white/[0.07] p-4.5 sm:p-5 flex flex-col gap-2.5 sm:gap-3 transition-all duration-300 hover:border-white/[0.15] hover:shadow-[0_8px_25px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 ${s.border}`}
              style={{ background: "linear-gradient(135deg, rgba(22,30,54,0.7) 0%, rgba(13,18,34,0.85) 100%)" }}>
              <span className="text-[9px] sm:text-[9.5px] font-bold text-neutral-400 uppercase tracking-widest font-mono">{s.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[1.8rem] sm:text-[2.25rem] font-extrabold text-white leading-none tracking-tight tabular-nums">{s.value}</span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-neutral-500">{s.sub}</span>
            </div>
          ))}
        </div>

        {/* ── TAB BAR ───────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 md:gap-1.5 md:p-1.5 rounded-xl border border-white/[0.06] overflow-x-auto max-w-full flex-nowrap scrollbar-none mb-6 md:mb-8"
          style={{ background: "rgba(22,30,54,0.6)", backdropFilter: "blur(8px)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`h-8 px-3.5 md:h-9 md:px-5 rounded-lg text-[11px] md:text-[12px] font-bold tracking-wide transition-all duration-300 focus:outline-none flex items-center gap-1.5 md:gap-2 shrink-0 cursor-pointer ${
                tab === t.id ? "bg-white/10 text-white shadow-md border border-white/[0.08]" : "text-neutral-400 hover:text-neutral-200"
              }`}>
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className={`text-[9px] md:text-[9.5px] font-extrabold px-1.5 md:px-2 py-0.5 rounded-full ${
                  tab === t.id ? "bg-[#00F2FE]/25 text-[#00F2FE]" : "bg-white/5 text-neutral-500"
                }`}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── NEW LEADS ─────────────────────────────────────────────────── */}
        {tab === "leads" && (
          <div className="flex flex-col gap-4">
            {newLeads.length === 0 ? (
              <EmptyBox text="No new leads yet. Share your intake form link to start getting submissions." />
            ) : newLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} busy={busyLead === lead.id}
                onPrimary={() => handleMarkClient(lead.id, lead.business_name)}
                onDelete={() => handleDeleteLead(lead.id, lead.business_name)}
                fmt={fmt} />
            ))}
          </div>
        )}

        {/* ── CLIENTS ───────────────────────────────────────────────────── */}
        {tab === "clients" && (
          <div className="flex flex-col gap-4">
            {clients.length === 0 ? (
              <EmptyBox text="No clients yet. Mark a lead as a client to move them here." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clients.map(c => (
                  <div key={c.id}
                    className="rounded-2xl border border-emerald-500/15 p-6 flex flex-col gap-4 transition-all duration-300 hover:border-emerald-500/35 hover:scale-[1.01] hover:shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
                    style={{ background: "linear-gradient(145deg, rgba(16,185,129,0.05) 0%, rgba(22,30,54,0.85) 100%)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[16px] font-extrabold text-white tracking-tight">{c.business_name}</div>
                        <div className="text-[11px] text-emerald-400 font-bold font-mono uppercase tracking-wider mt-1">{c.category}</div>
                      </div>
                      <span className="text-[9px] font-extrabold px-3 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest shrink-0 font-mono">Active Client</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] border-t border-white/[0.05] pt-3">
                      <InfoRow label="Region" value={c.region} />
                      <InfoRow label="Volume" value={c.monthly_volume} />
                      <InfoRow label="WhatsApp" value={c.whatsapp_num} selectable />
                      <InfoRow label="Email" value={c.email} selectable />
                    </div>
                    <button onClick={() => handleDeleteLead(c.id, c.business_name)} disabled={busyLead === c.id}
                      className="self-start h-8 px-4 text-[10px] font-bold uppercase tracking-wider text-red-400/80 hover:text-red-400 border border-red-500/10 hover:border-red-500/35 bg-red-500/5 rounded-lg transition-all focus:outline-none disabled:opacity-40 cursor-pointer">
                      Remove Client
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REVIEWS ───────────────────────────────────────────────────── */}
        {tab === "reviews" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending */}
            <div className="flex flex-col gap-4">
              <SectionHeader label="Needs Approval" count={pending.length} countColor="amber" />
              {pending.length === 0 ? <EmptyBox text="All clear — no reviews waiting." /> :
                pending.map(r => (
                  <ReviewCard key={r.id} review={r} busy={busyReview === r.id} fmt={fmt}
                    actions={
                      <div className="flex gap-2">
                        <Btn onClick={() => handleApprove(r.id)} disabled={busyReview !== null} color="emerald">Approve</Btn>
                        <Btn onClick={() => handleDeleteReview(r.id, r.name)} disabled={busyReview !== null} color="red">Delete</Btn>
                      </div>
                    }
                  />
                ))
              }
            </div>
            {/* Live */}
            <div className="flex flex-col gap-4">
              <SectionHeader label="Live on Site" count={live.length} countColor="emerald" />
              {live.length === 0 ? <EmptyBox text="No approved reviews yet." /> :
                live.map(r => (
                  <ReviewCard key={r.id} review={r} busy={busyReview === r.id} fmt={fmt}
                    live
                    actions={<Btn onClick={() => handleDeleteReview(r.id, r.name)} disabled={busyReview !== null} color="red">Remove</Btn>}
                  />
                ))
              }
            </div>
          </div>
        )}

        {/* ── ADMIN ACCESS ──────────────────────────────────────────────── */}
        {tab === "access" && (
          <div className="max-w-md flex flex-col gap-6">
            <p className="text-[12px] text-neutral-400 leading-relaxed font-medium">
              Authorize additional email addresses to manage the command center. Authorized accounts will be prompted for security verification and directed here upon signing in.
            </p>
            <form onSubmit={handleAddAdmin} className="flex gap-2.5">
              <input type="email" required value={newEmail}
                onChange={e => { setNewEmail(e.target.value); setAdminMsg(null); }}
                placeholder="email@example.com"
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] focus:border-[#00F2FE]/40 focus:ring-1 focus:ring-[#00F2FE]/15 px-4 py-3 text-[13px] text-white placeholder-neutral-600 outline-none transition-all" />
              <button type="submit" disabled={adminBusy || !newEmail.trim()}
                className="h-11 px-6 rounded-xl border border-[#00F2FE]/20 bg-[#00F2FE]/10 hover:bg-[#00F2FE]/20 text-[11px] font-bold uppercase tracking-wider text-[#00F2FE] hover:text-white transition-all focus:outline-none disabled:opacity-40 cursor-pointer">
                {adminBusy ? "..." : "Authorize"}
              </button>
            </form>
            {adminMsg && (
              <p className={`text-[12px] font-semibold ${adminMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>{adminMsg.text}</p>
            )}
            <div className="flex flex-col gap-3 mt-2">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">Current Admin List</span>
              {adminEmails.map(email => (
                <div key={email}
                  className="flex items-center justify-between px-4.5 py-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-[#00F2FE] flex items-center justify-center text-[10px] font-bold text-white uppercase font-mono">
                      {email.slice(0, 1)}
                    </div>
                    <span className="text-[12px] font-medium text-white select-text">{email}</span>
                    {email === adminEmail && (
                      <span className="text-[8.5px] font-bold px-2 py-0.5 rounded border border-[#00F2FE]/25 text-[#00F2FE] bg-[#00F2FE]/5 font-mono uppercase tracking-wider">Root</span>
                    )}
                  </div>
                  {email !== adminEmail && (
                    <button onClick={() => handleRemoveAdmin(email)} disabled={adminBusy}
                      className="text-[11px] font-bold text-neutral-500 hover:text-red-400 transition-colors focus:outline-none disabled:opacity-40 cursor-pointer">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── SIGN OUT MODAL ────────────────────────────────────────────────── */}
      {showSignOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-modal-backdrop"
          onClick={() => setShowSignOut(false)}>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 p-6 flex flex-col gap-5 shadow-2xl"
            style={{ background: "rgba(10,12,20,0.98)", backdropFilter: "blur(30px)" }}
            onClick={e => e.stopPropagation()}>
            <div>
              <div className="text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1 font-mono">Sign Out</div>
              <h2 className="text-sm font-bold text-white">End your session?</h2>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">You'll be redirected to the main site.</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => setShowSignOut(false)}
                className="h-9.5 rounded-xl border border-white/10 bg-white/[0.04] text-[11px] font-medium text-neutral-300 hover:text-white transition-all focus:outline-none cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSignOut}
                className="h-9.5 rounded-xl border border-red-500/25 bg-red-500/[0.08] text-[11px] font-medium text-red-400 hover:bg-red-500/20 hover:text-white transition-all focus:outline-none cursor-pointer">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.05] p-12 flex flex-col items-center gap-3 text-center"
      style={{ background: "linear-gradient(to bottom, rgba(22,30,54,0.3) 0%, rgba(13,18,34,0.4) 100%)" }}>
      <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center bg-white/[0.02]">
        <span className="text-neutral-500 text-sm">○</span>
      </div>
      <p className="text-[12px] text-neutral-500 max-w-xs leading-relaxed font-medium">{text}</p>
    </div>
  );
}

function SectionHeader({ label, count, countColor }: { label: string; count: number; countColor: "amber" | "emerald" | "blue" }) {
  const colors = { amber: "text-amber-400 border-amber-500/25 bg-amber-500/5", emerald: "text-emerald-400 border-emerald-500/25 bg-emerald-500/5", blue: "text-[#00F2FE] border-[#00F2FE]/25 bg-[#00F2FE]/5" };
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-[13px] font-bold text-white tracking-wide uppercase font-mono">{label}</span>
      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border font-mono ${colors[countColor]}`}>{count}</span>
    </div>
  );
}

function InfoRow({ label, value, selectable }: { label: string; value: string; selectable?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5"><span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider font-mono">{label}</span><span className={`text-neutral-200 font-medium ${selectable ? "select-text" : ""}`}>{value}</span></div>
  );
}

function Btn({ children, onClick, disabled, color }: { children: React.ReactNode; onClick: () => void; disabled: boolean; color: "emerald" | "red" }) {
  const c = { emerald: "text-emerald-400 border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/45", red: "text-red-400 border-red-500/25 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/45" };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`h-8 px-4 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all focus:outline-none disabled:opacity-40 cursor-pointer ${c[color]}`}>
      {children}
    </button>
  );
}

function ReviewCard({ review, busy, fmt, live, actions }: {
  review: Review; busy: boolean; fmt: (d: string) => string;
  live?: boolean; actions: React.ReactNode;
}) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [review.avatar_url, review.email]);

  const emailHash = review.email ? md5(review.email.trim().toLowerCase()) : "";
  const gravatarUrl = emailHash ? `https://www.gravatar.com/avatar/${emailHash}?d=404` : null;

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.35)] ${busy ? "opacity-40" : ""} ${
      live ? "border-emerald-500/15 hover:border-emerald-500/35" : "border-white/[0.07] hover:border-white/[0.15]"
    }`} style={{ background: "linear-gradient(135deg, rgba(22,30,54,0.7) 0%, rgba(13,18,34,0.85) 100%)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          {(() => {
            const avatarSrc = review.avatar_url || gravatarUrl;
            return avatarSrc && !imgError ? (
              <img
                src={avatarSrc}
                alt={review.name}
                onError={() => setImgError(true)}
                className="w-10 h-10 rounded-full border border-white/10 shrink-0 object-cover shadow-sm animate-in fade-in duration-300"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#3B82F6] to-[#00F2FE] border border-white/10 flex items-center justify-center font-mono font-extrabold text-[11px] text-white uppercase shrink-0 shadow-sm">
                {(review.name || "AA").slice(0, 2)}
              </div>
            );
          })()}
          <div>
            <div className="text-[14px] font-bold text-white tracking-tight">{review.name}</div>
            <div className="text-[11px] text-neutral-400 font-medium font-mono uppercase tracking-wider mt-0.5">{review.role}</div>
          </div>
        </div>
        <div className="flex gap-0.5 shrink-0 bg-white/[0.02] border border-white/[0.05] px-2 py-1 rounded-lg">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={`text-[12px] ${i < review.rating ? "text-amber-400" : "text-neutral-800"}`}>★</span>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-neutral-300 italic leading-relaxed bg-[#0C1020]/40 border border-white/[0.04] p-3.5 rounded-xl">"{review.feedback}"</p>
      <div className="flex items-center justify-between border-t border-white/[0.05] pt-3 mt-1">
        <span className="text-[10px] text-neutral-500 font-mono">{fmt(review.created_at)}</span>
        {actions}
      </div>
    </div>
  );
}

function LeadCard({ lead, busy, onPrimary, onDelete, fmt }: {
  lead: Lead; busy: boolean;
  onPrimary: () => void; onDelete: () => void; fmt: (d: string) => string;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  };

  return (
    <div
      className={`rounded-2xl border border-white/[0.07] hover:border-[#3B82F6]/30 transition-all duration-300 hover:scale-[1.005] hover:shadow-[0_12px_45px_rgba(0,0,0,0.4)] overflow-hidden cursor-default ${busy ? "opacity-40" : ""}`}
      style={{ background: "linear-gradient(to bottom, #131A2D, #0D1222)" }}
    >
      {/* ── TOP: Identity + Actions ── */}
      <div className="px-6 pt-6 pb-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/[0.04]">
        <div className="flex flex-col gap-2">
          <span className="text-[18px] font-extrabold text-white tracking-tight leading-snug">{lead.business_name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9.5px] font-extrabold px-2.5 py-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-neutral-400 font-mono uppercase tracking-wider">{lead.category}</span>
            <span className="text-neutral-700 text-xs">·</span>
            <span className="text-[11px] text-neutral-400 font-semibold">{lead.region}</span>
            <span className="text-neutral-700 text-xs">·</span>
            <span className="text-[10px] text-neutral-500 font-mono font-medium">{fmt(lead.created_at)}</span>
          </div>
        </div>
        <div className="flex gap-2.5 shrink-0 self-start sm:self-center">
          <button
            onClick={onPrimary} disabled={busy}
            className="h-8 px-4 text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.14] hover:border-emerald-500/40 rounded-lg transition-all focus:outline-none disabled:opacity-40 cursor-pointer"
          >
            Mark as Client
          </button>
          <button
            onClick={onDelete} disabled={busy}
            className="h-8 px-3.5 text-[10.5px] font-extrabold uppercase tracking-wider text-neutral-400 hover:text-red-400 border border-white/[0.08] hover:border-red-500/35 bg-white/[0.02] hover:bg-red-500/[0.08] rounded-lg transition-all focus:outline-none disabled:opacity-40 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ── CONTACT — primary info, terminal-style copyable panels ── */}
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/[0.04]">
        {/* WhatsApp Panel */}
        <div
          onClick={() => copy(lead.whatsapp_num, "wa")}
          className="flex flex-col gap-2 p-4 rounded-xl border border-white/[0.06] bg-[#0A0D18] hover:bg-[#0D1222] hover:border-white/[0.12] transition-all duration-200 group relative cursor-pointer"
        >
          <div className="flex justify-between items-center select-none">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#00F2FE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">WhatsApp Contact</span>
            </div>
            <span className={`text-[10px] font-bold font-mono tracking-wider transition-colors ${copied === "wa" ? "text-emerald-400" : "text-neutral-600 group-hover:text-neutral-300"}`}>
              {copied === "wa" ? "COPIED ✓" : "CLICK TO COPY"}
            </span>
          </div>
          <div className="text-[17px] font-mono font-extrabold text-white tracking-wide mt-1 select-text">
            {lead.whatsapp_num}
          </div>
        </div>

        {/* Email Panel */}
        <div
          onClick={() => copy(lead.email, "em")}
          className="flex flex-col gap-2 p-4 rounded-xl border border-white/[0.06] bg-[#0A0D18] hover:bg-[#0D1222] hover:border-white/[0.12] transition-all duration-200 group relative cursor-pointer"
        >
          <div className="flex justify-between items-center select-none">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#00F2FE]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">Email Address</span>
            </div>
            <span className={`text-[10px] font-bold font-mono tracking-wider transition-colors ${copied === "em" ? "text-emerald-400" : "text-neutral-600 group-hover:text-neutral-300"}`}>
              {copied === "em" ? "COPIED ✓" : "CLICK TO COPY"}
            </span>
          </div>
          <div className="text-[15px] font-mono font-extrabold text-neutral-200 mt-1 select-text truncate">
            {lead.email}
          </div>
        </div>
      </div>

      {/* ── SECONDARY INFO GRID ── */}
      <div className="px-6 py-4.5 bg-black/[0.08] grid grid-cols-3 gap-4">
        {[
          { label: "Current System", value: lead.current_system },
          { label: "Monthly Volume", value: lead.monthly_volume },
          { label: "Operational Region", value: lead.region },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">{label}</span>
            <span className="text-[12.5px] font-semibold text-neutral-300 truncate">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
