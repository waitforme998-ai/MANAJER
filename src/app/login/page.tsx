"use client";

import { useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";

function LoginRedirectContent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?login=true");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#03050A] flex items-center justify-center">
      <div className="w-5 h-5 border border-[#00F2FE]/20 border-t-[#00F2FE] rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#03050A] flex items-center justify-center">
          <div className="w-5 h-5 border border-[#00F2FE]/20 border-t-[#00F2FE] rounded-full animate-spin" />
        </div>
      }
    >
      <LoginRedirectContent />
    </Suspense>
  );
}
