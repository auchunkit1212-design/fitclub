"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { applyDocumentTheme, normalizeThemeColor } from "@/lib/brand";
import {
  readLastBrand,
  resolveDisplayBrandLogo,
  writeLastBrand,
} from "@/lib/brand-logo";
import { SESSION_CHANGE_EVENT, getSession } from "@/lib/session";
import { DEFAULT_BRANDING, DEFAULT_GYM_NAME, type ThemeColor } from "@/lib/types";

interface BrandingState {
  gymName: string;
  appTitle: string;
  logo?: string;
  tenantSlug?: string;
  themeColor: ThemeColor;
}

const BrandingContext = createContext<BrandingState>({
  gymName: DEFAULT_GYM_NAME,
  appTitle: DEFAULT_BRANDING.appTitle,
  themeColor: DEFAULT_BRANDING.themeColor,
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
    themeColor: normalizeThemeColor(last?.themeColor),
  };
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandingState>({
    gymName: DEFAULT_GYM_NAME,
    appTitle: DEFAULT_BRANDING.appTitle,
    themeColor: DEFAULT_BRANDING.themeColor,
  });

  useLayoutEffect(() => {
    const sync = () => {
      const session = getSession();
      if (session?.isLoggedIn) {
        const last = readLastBrand();
        const next: BrandingState = {
          gymName: session.brandName ?? session.gym ?? DEFAULT_GYM_NAME,
          appTitle:
            session.brandName ?? session.gym ?? DEFAULT_BRANDING.appTitle,
          logo: resolveDisplayBrandLogo(session),
          tenantSlug: session.tenantSlug,
          themeColor: normalizeThemeColor(
            session.themeColor ?? last?.themeColor
          ),
        };
        setBrand(next);
        writeLastBrand({
          gymName: next.gymName,
          logo: next.logo,
          tenantSlug: next.tenantSlug,
          themeColor: next.themeColor,
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

  useLayoutEffect(() => {
    applyDocumentTheme(brand.themeColor);
  }, [brand.themeColor]);

  const value = useMemo(() => brand, [brand]);

  return (
    <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
  );
}
