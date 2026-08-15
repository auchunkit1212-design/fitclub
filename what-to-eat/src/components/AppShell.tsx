"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND_NAME_ZH } from "@/lib/constants";
import { getStoredLanguage, t, type AppLanguage } from "@/lib/i18n";
import { clearSession, getSession } from "@/lib/session";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [lang, setLang] = useState<AppLanguage>("zh-HK");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setLang(getStoredLanguage());
    const s = getSession();
    setEmail(s?.email ?? null);
  }, [pathname]);

  const hideNav = pathname === "/login";

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-leaf-mist/80 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-coral-soft/60 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a2e28' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <header className="relative z-10 border-b border-ink/10 bg-sand/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 pt-safe">
          <Link href="/" className="group">
            <p className="font-display text-2xl font-semibold tracking-tight text-leaf-deep transition group-hover:text-leaf">
              {BRAND_NAME_ZH}
            </p>
            <p className="text-xs text-ink-muted">{t(lang, "brand.tagline")}</p>
          </Link>
          {!hideNav && email && (
            <nav className="flex flex-wrap items-center gap-1 text-sm">
              {(
                [
                  ["/", "nav.plan"],
                  ["/onboarding", "nav.onboarding"],
                  ["/settings", "nav.settings"],
                ] as const
              ).map(([href, key]) => (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    pathname === href
                      ? "bg-leaf text-white"
                      : "text-ink-soft hover:bg-leaf-mist"
                  }`}
                >
                  {t(lang, key)}
                </Link>
              ))}
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-ink-muted hover:bg-coral-soft"
                onClick={() => {
                  clearSession();
                  router.push("/login");
                }}
              >
                {t(lang, "nav.logout")}
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-4 py-6 pb-safe">
        {children}
      </main>
    </div>
  );
}
