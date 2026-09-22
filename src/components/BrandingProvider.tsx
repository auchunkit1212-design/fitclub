"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readLastBrand,
  resolveDisplayBrandLogo,
  writeLastBrand,
} from "@/lib/brand-logo";
import { SESSION_CHANGE_EVENT, getSession } from "@/lib/session";
import { DEFAULT_BRANDING, DEFAULT_GYM_NAME } from "@/lib/types";

interface BrandingState {
  gymName: string;
  appTitle: string;
  logo?: string;
  tenantSlug?: string;
}

const BrandingContext = createContext<BrandingState>({
  gymName: DEFAULT_GYM_NAME,
  appTitle: DEFAULT_BRANDING.appTitle,
});

export function useBranding() {
  return useContext(BrandingContext);
}

function brandFromLastKnown(): BrandingState {
  const last = readLastBrand();
  return {
    gymName: last?.gymName ?? DEFAULT_GYM_NAME,
    appTitle: last?.gymName ?? DEFAULT_BRANDING.appTitle,
    logo: last?.logo,
    tenantSlug: last?.tenantSlug,
  };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandingState>({
    gymName: DEFAULT_GYM_NAME,
    appTitle: DEFAULT_BRANDING.appTitle,
  });

  useLayoutEffect(() => {
    const sync = () => {
      const session = getSession();
      if (session?.isLoggedIn) {
        const next: BrandingState = {
          gymName: session.brandName ?? session.gym ?? DEFAULT_GYM_NAME,
          appTitle:
            session.brandName ?? session.gym ?? DEFAULT_BRANDING.appTitle,
          logo: resolveDisplayBrandLogo(session),
          tenantSlug: session.tenantSlug,
        };
        setBrand(next);
        writeLastBrand({
          gymName: next.gymName,
          logo: next.logo,
          tenantSlug: next.tenantSlug,
        });
        return;
      }

      setBrand(brandFromLastKnown());
    };

    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(SESSION_CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SESSION_CHANGE_EVENT, sync);
    };
  }, []);

  const value = useMemo(() => brand, [brand]);

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}
