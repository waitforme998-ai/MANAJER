"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

export default function IntakeTerminal() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    business_name: "",
    category: "",
    region: "",
    current_system: "",
    monthly_volume: "",
    whatsapp_num: "",
    email: "",
  });
  const [status, setStatus] = useState<"IDLE" | "SUBMITTING" | "SUCCESS" | "ERROR">("IDLE");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, nextAction: () => void) => {
    if (e.key === "Enter" && e.currentTarget.value.trim() !== "") {
      nextAction();
    }
  };

  const submitData = async () => {
    setStatus("SUBMITTING");
    const { error } = await supabase.from("leads").insert([
      { ...formData, status: "PENDING" }
    ]);
    if (error) {
      console.error(error);
      setStatus("ERROR");
    } else {
      setStatus("SUCCESS");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono tracking-widest uppercase p-4 md:p-12 relative overflow-hidden">
      {/* 1px Grid Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto flex flex-col gap-8 h-full">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-[#333] pb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border border-[#333] flex items-center justify-center bg-[#1A1A1A]">
              <Image src="/logo.webp" alt="MANAJER.PK" width={48} height={48} className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-[0.2em]">[SYS_ROOT] // INTAKE_PROTOCOL</h1>
              <p className="text-[#888] text-sm mt-1">PROTOCOL: AUTOMATED_INTAKE_V4.1</p>
            </div>
          </div>
          <div className="hidden md:flex flex-col items-end text-xs text-[#888]">
            <span>SYSTEM.STATUS: ONLINE</span>
            <span>SECURE.CONNECTION: VERIFIED</span>
          </div>
        </header>

        {/* Terminal Content */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* STEP 1 */}
          <div className={`transition-opacity duration-300 ${step >= 1 ? 'opacity-100' : 'opacity-0 hidden'}`}>
            <div className="text-[#888] mb-4 border-l border-[#333] pl-4">-- STEP 01: IDENTITY PARSING --</div>
            <div className="flex flex-col gap-4 pl-4">
              <div className="flex items-center gap-2">
                <span className="text-white">&gt; [ENTER BRAND/BUSINESS NAME]:</span>
                {step === 1 ? (
                  <input
                    ref={inputRef}
                    type="text"
                    name="business_name"
                    value={formData.business_name}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, () => setStep(2))}
                    className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                    placeholder="TYPE HERE..."
                    autoComplete="off"
                  />
                ) : (
                  <span className="text-[#888]">{formData.business_name}</span>
                )}
              </div>

              <div className={`transition-opacity duration-300 flex items-center gap-2 ${step >= 2 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <span className="text-white">&gt; [CATEGORY / SECTOR]:</span>
                {step === 2 ? (
                  <input
                    ref={inputRef}
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, () => setStep(3))}
                    className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                    placeholder="E.G., CLOTHING, JEWELRY"
                    autoComplete="off"
                  />
                ) : (
                  <span className="text-[#888]">{formData.category}</span>
                )}
              </div>

              <div className={`transition-opacity duration-300 flex items-center gap-2 ${step >= 3 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <span className="text-white">&gt; [OPERATIONAL REGION]:</span>
                {step === 3 ? (
                  <input
                    ref={inputRef}
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    onKeyDown={(e) => handleKeyDown(e, () => setStep(4))}
                    className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                    placeholder="E.G., PAKISTAN, GLOBAL"
                    autoComplete="off"
                  />
                ) : (
                  <span className="text-[#888]">{formData.region}</span>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2 */}
          {step >= 4 && (
            <div className={`transition-opacity duration-300 ${step >= 4 ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <div className="text-[#888] mb-4 mt-6 border-l border-[#333] pl-4">-- STEP 02: FRICTION LOGGING (QUALIFICATION ENGINE) --</div>
              <div className="flex flex-col gap-4 pl-4">
                <div className="flex items-center gap-2">
                  <span className="text-white">&gt; [CURRENT SYSTEM: MANUAL / LEGACY / NONE]:</span>
                  {step === 4 ? (
                    <input
                      ref={inputRef}
                      type="text"
                      name="current_system"
                      value={formData.current_system}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, () => setStep(5))}
                      className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                      placeholder="YOUR SYSTEM"
                      autoComplete="off"
                    />
                  ) : (
                    <span className="text-[#888]">{formData.current_system}</span>
                  )}
                </div>

                <div className={`transition-opacity duration-300 flex items-center gap-2 ${step >= 5 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <span className="text-white">&gt; [ESTIMATED MONTHLY VOLUME / ORDERS]:</span>
                  {step === 5 ? (
                    <input
                      ref={inputRef}
                      type="text"
                      name="monthly_volume"
                      value={formData.monthly_volume}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, () => setStep(6))}
                      className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                      placeholder="E.G., 500/MO"
                      autoComplete="off"
                    />
                  ) : (
                    <span className="text-[#888]">{formData.monthly_volume}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step >= 6 && (
            <div className={`transition-opacity duration-300 ${step >= 6 ? 'opacity-100' : 'opacity-0 hidden'}`}>
              <div className="text-[#888] mb-4 mt-6 border-l border-[#333] pl-4">-- STEP 03: COMMUNICATIONS ROUTING --</div>
              <div className="flex flex-col gap-4 pl-4">
                <div className="flex items-center gap-2">
                  <span className="text-white">&gt; [WHATSAPP BUSINESS ENDPOINT]:</span>
                  {step === 6 ? (
                    <input
                      ref={inputRef}
                      type="text"
                      name="whatsapp_num"
                      value={formData.whatsapp_num}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, () => setStep(7))}
                      className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                      placeholder="+92..."
                      autoComplete="off"
                    />
                  ) : (
                    <span className="text-[#888]">{formData.whatsapp_num}</span>
                  )}
                </div>

                <div className={`transition-opacity duration-300 flex items-center gap-2 ${step >= 7 ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <span className="text-white">&gt; [PRIMARY OPERATIONAL EMAIL]:</span>
                  {step === 7 ? (
                    <input
                      ref={inputRef}
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onKeyDown={(e) => handleKeyDown(e, () => setStep(8))}
                      className="bg-transparent border-b border-[#333] focus:border-white outline-none flex-1 py-1 text-white placeholder-[#333] rounded-none"
                      placeholder="CONTACT@..."
                      autoComplete="off"
                    />
                  ) : (
                    <span className="text-[#888]">{formData.email}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUBMIT */}
          {step >= 8 && (
            <div className="mt-8 border border-[#333] p-6 flex flex-col items-center justify-center bg-[#0a0a0a]">
              {status === "SUCCESS" ? (
                <div className="text-green-500 font-bold tracking-widest">[SYSTEM: INTAKE COMPLETE. STAND BY FOR TRANSMISSION.]</div>
              ) : status === "ERROR" ? (
                <div className="text-red-500 font-bold tracking-widest">[ERROR: TRANSMISSION FAILED. RETRY INITIATED.]</div>
              ) : (
                <button
                  onClick={submitData}
                  disabled={status === "SUBMITTING"}
                  className="px-8 py-4 bg-white text-black font-bold tracking-widest hover:bg-[#ccc] transition-colors border border-transparent rounded-none flex items-center gap-2"
                >
                  {status === "SUBMITTING" ? (
                    <>[PROCESSING...]</>
                  ) : (
                    <>[STATUS: SUBMITTING]</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <footer className="border-t border-[#333] pt-4 mt-8 flex justify-between items-center text-xs text-[#555]">
          <div>&copy; {new Date().getFullYear()} MANAJER.PK</div>
          <div>TERMINAL: AWAITING INPUT...</div>
        </footer>
      </div>
    </div>
  );
}
