"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { goTo } from "@/lib/navigate";
import {
  SESSION_CHANGE_EVENT,
  getSession,
} from "@/lib/session";
import type { UserSession } from "@/lib/types";

type SessionContextValue = {
  session: UserSession | null;
  checked: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  checked: false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const current = getSession();
    setSession(current);
    setChecked(true);

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<UserSession | null>).detail;
      setSession(detail ?? null);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "current_session") return;
      setSession(getSession());
    };

    window.addEventListener(SESSION_CHANGE_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo(() => ({ session, checked }), [session, checked]);
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useAppSession() {
  return useContext(SessionContext);
}

export const STUDENT_ROLE = ["student"] as const;
export const COACH_ROLES = ["coach", "admin"] as const;

export function useRequiredSession(
  allowedRoles?: ReadonlyArray<UserSession["role"]>
) {
  const router = useRouter();
  const { session, checked } = useAppSession();

  useEffect(() => {
    if (!checked) return;
    if (!session) {
      goTo(router, "/register");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(session.role)) {
      goTo(router, "/");
    }
  }, [allowedRoles, checked, router, session]);

  return { session, checked };
}
