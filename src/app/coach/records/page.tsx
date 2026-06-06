"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 舊連結導向「學員」分欄 */
export default function CoachRecordsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/coach/students");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
      前往學員頁面…
    </div>
  );
}
