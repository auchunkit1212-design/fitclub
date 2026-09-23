"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { readInviteCodeFromSearch } from "@/lib/invite-url";

interface RegisterInvitePrefillProps {
  onPrefill: (code: string) => void;
}

/** 從 ?invite= 或 ?code= 預填學員註冊邀請碼 */
export function RegisterInvitePrefill({ onPrefill }: RegisterInvitePrefillProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const fromParams = readInviteCodeFromSearch(
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    );
    const code = fromParams || readInviteCodeFromSearch(window.location.search);
    if (code) onPrefill(code);
  }, [searchParams, onPrefill]);

  return null;
}
