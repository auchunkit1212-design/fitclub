"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface RegisterInvitePrefillProps {
  onPrefill: (code: string) => void;
}

/** 從 ?invite= 或 ?code= 預填學員註冊邀請碼 */
export function RegisterInvitePrefill({ onPrefill }: RegisterInvitePrefillProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code =
      searchParams.get("invite")?.trim() ||
      searchParams.get("code")?.trim() ||
      "";
    if (code) onPrefill(code);
  }, [searchParams, onPrefill]);

  return null;
}
