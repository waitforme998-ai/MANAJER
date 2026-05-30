"use client";

/**
 * ─── COMMAND CENTER HYDRATION SKELETON ────────────────────────────────────────
 *
 * Implements a premium, high-performance visual loading layout using soft
 * pulsing cyber-minimalist outlines. Prevents layout shift and ensures
 * instant response perception under high-latency 3G/4G cell networks.
 */

export default function CommandCenterLoading() {
  return (
    <div className="w-full min-h-screen bg-[#03050A] text-white p-6 md:p-8 flex flex-col gap-6 select-none cursor-default font-mono">
      {/* ── HEADER BAR SKELETON ── */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-900">
        <div className="flex flex-col gap-2">
          <div className="h-2 w-28 bg-[#00F2FE]/10 border border-[#00F2FE]/20 rounded animate-pulse" />
          <div className="h-4 w-40 bg-neutral-900 border border-neutral-800 rounded animate-pulse" />
        </div>
        <div className="h-8 w-24 bg-neutral-900 border border-neutral-800 rounded animate-pulse" />
      </div>

      {/* ── METRICS HERO GRID SKELETON ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-neutral-900/40 backdrop-blur-md border border-neutral-900 p-4 rounded-lg flex flex-col gap-3 h-24 animate-pulse"
          >
            <div className="h-2 w-24 bg-neutral-800 rounded" />
            <div className="h-5 w-32 bg-neutral-800/60 rounded mt-1" />
          </div>
        ))}
      </div>

      {/* ── COMMAND TAB BAR SKELETON ── */}
      <div className="flex flex-wrap gap-2.5 mt-2 border-b border-neutral-900 pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-44 bg-neutral-900/50 border border-neutral-950 rounded-lg animate-pulse"
          />
        ))}
      </div>

      {/* ── MAIN WORKSPACE VIEWPORT SKELETON ── */}
      <div className="border border-neutral-900 bg-neutral-950/20 p-6 rounded-xl flex flex-col gap-4 animate-pulse h-96 mt-2">
        <div className="h-3 w-48 bg-neutral-900 rounded" />
        <div className="w-full h-px bg-neutral-900" />
        <div className="flex flex-col gap-3">
          <div className="h-4 w-full bg-neutral-900/40 rounded" />
          <div className="h-4 w-5/6 bg-neutral-900/40 rounded" />
          <div className="h-4 w-4/5 bg-neutral-900/40 rounded" />
          <div className="h-4 w-full bg-neutral-900/40 rounded" />
        </div>
      </div>
    </div>
  );
}
