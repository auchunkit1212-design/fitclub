"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/api-client";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export default function SettingsPage() {
  const { tt, lang, setLang } = useI18n();
  const router = useRouter();
  const [billingUrl, setBillingUrl] = useState("http://localhost:3000/billing");
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (!getSession()?.email) {
      router.replace("/login");
      return;
    }
    void (async () => {
      const res = await apiFetch("/api/me/plan");
      if (!res.ok) return;
      const data = (await res.json()) as {
        isPro?: boolean;
        billingUrl?: string;
      };
      setIsPro(Boolean(data.isPro));
      if (data.billingUrl) setBillingUrl(data.billingUrl);
    })();
  }, [router]);

  return (
    <section className="animate-fade-up space-y-6">
      <h1 className="font-display text-3xl text-leaf-deep">
        {tt("settings.title")}
      </h1>

      <div className="rounded-2xl border border-ink/10 bg-white/75 p-5">
        <p className="text-sm font-medium text-ink">{tt("settings.language")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l as AppLanguage)}
              className={`rounded-lg px-3 py-2 text-sm ${
                lang === l ? "bg-leaf text-white" : "bg-sand text-ink-soft"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/75 p-5">
        <p className="text-sm font-medium text-ink">{tt("settings.billing")}</p>
        <p className="mt-2 text-sm text-ink-muted">{tt("settings.billingHint")}</p>
        <p className="mt-2 text-sm text-leaf-deep">
          {isPro ? tt("plan.pro") : "Free"}
        </p>
        <a
          href={billingUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-xl bg-coral px-4 py-2.5 text-sm text-white hover:opacity-90"
        >
          {tt("settings.openBilling")}
        </a>
      </div>
    </section>
  );
}
