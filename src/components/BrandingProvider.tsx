"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSession } from "@/lib/session";
import { DEFAULT_BRANDING, DEFAULT_GYM_NAME } from "@/lib/types";

interface BrandingState {
  gymName: string;
  appTitle: string;
  logo?: string;
}

const BrandingContext = createContext<BrandingState>({
  gymName: DEFAULT_GYM_NAME,
  appTitle: DEFAULT_BRANDING.appTitle,
});

export function useBranding() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandingState>({
    gymName: DEFAULT_GYM_NAME,
    appTitle: DEFAULT_BRANDING.appTitle,
  });

  useEffect(() => {
    const sync = () => {
      const session = getSession();
      if (session?.isLoggedIn) {
        setBrand({
          gymName: session.brandName ?? session.gym ?? DEFAULT_GYM_NAME,
          appTitle: session.brandName ?? session.gym ?? DEFAULT_BRANDING.appTitle,
          logo: session.brandLogo,
        });
      } else {
        setBrand({
          gymName: DEFAULT_GYM_NAME,
          appTitle: DEFAULT_BRANDING.appTitle,
        });
      }
    };

    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const value = useMemo(() => brand, [brand]);

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}
