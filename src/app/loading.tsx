import { cookies } from "next/headers";
import { AppLoadingScreen } from "@/components/AppLoadingScreen";
import {
  LAST_BRAND_COOKIE,
  parseLastBrandJson,
  resolveDisplayBrandLogo,
} from "@/lib/brand-logo";
import type { UserSession } from "@/lib/types";

function readCookieSession(raw?: string): UserSession | null {
  if (!raw) return null;
  for (const candidate of [raw, decodeURIComponentSafe(raw)]) {
    if (!candidate) continue;
    try {
      const session = JSON.parse(candidate) as UserSession;
      if (session?.email) return session;
    } catch {
      // try next
    }
  }
  return null;
}

function decodeURIComponentSafe(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export default function AppLoading() {
  const jar = cookies();
  const last = parseLastBrandJson(jar.get(LAST_BRAND_COOKIE)?.value);
  const session = readCookieSession(jar.get("current_session")?.value);
  const logoUrl = resolveDisplayBrandLogo(session) ?? last?.logo;

  return <AppLoadingScreen logoUrl={logoUrl} />;
}
