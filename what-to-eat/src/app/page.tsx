"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/api-client";
import {
  FREE_MONTHLY_GENERATE_LIMIT,
  FREE_REGENERATE_PER_PLAN,
} from "@/lib/constants";
import { getSession } from "@/lib/session";
import type { WteMealPlanRow, WeeklyMealPlanPayload } from "@/lib/types";

type PlanWithRegen = WteMealPlanRow & { regenerateCount?: number };

export default function HomePlanPage() {
  const { tt } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<PlanWithRegen | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [used, setUsed] = useState(0);
  const [billingUrl, setBillingUrl] = useState("http://localhost:3000/billing");
  const [favorited, setFavorited] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);

  const refresh = useCallback(async () => {
    if (!getSession()?.email) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [planRes, usageRes, profileRes] = await Promise.all([
        apiFetch("/api/meal-plan/favorites"),
        apiFetch("/api/me/plan"),
        apiFetch("/api/me/profile"),
      ]);
      if (planRes.ok) {
        const data = (await planRes.json()) as {
          latest?: PlanWithRegen | null;
          favorites?: PlanWithRegen[];
          isPro?: boolean;
        };
        setPlan(data.latest ?? null);
        setIsPro(Boolean(data.isPro));
        if (data.latest && data.favorites?.some((f) => f.id === data.latest!.id)) {
          setFavorited(true);
        }
      }
      if (usageRes.ok) {
        const u = (await usageRes.json()) as {
          isPro?: boolean;
          generateUsed?: number;
          billingUrl?: string;
        };
        setIsPro(Boolean(u.isPro));
        setUsed(Number(u.generateUsed ?? 0));
        if (u.billingUrl) setBillingUrl(u.billingUrl);
      }
      if (profileRes.ok) {
        const p = (await profileRes.json()) as {
          diet?: { onboardingComplete?: boolean } | null;
        };
        if (!p.diet?.onboardingComplete) {
          router.replace("/onboarding");
          return;
        }
      }
    } catch {
      setError(tt("common.error"));
    } finally {
      setLoading(false);
    }
  }, [router, tt]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/meal-plan/generate", { method: "POST", body: "{}" });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        billingUrl?: string;
        plan?: PlanWithRegen;
      };
      if (!res.ok) {
        setError(data.message || data.error || tt("common.error"));
        if (data.billingUrl) setBillingUrl(data.billingUrl);
        return;
      }
      if (data.plan) {
        setPlan(data.plan);
        setSelectedDay(0);
        setFavorited(false);
        setUsed((u) => u + (isPro ? 0 : 1));
      }
    } catch {
      setError(tt("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(focusDate?: string, focusSlot?: string) {
    if (!plan?.id || plan.id === "local-preview") {
      setError("請先成功儲存一份餐單再 regenerate");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch("/api/meal-plan/regenerate", {
        method: "POST",
        body: JSON.stringify({
          planId: plan.id,
          focusDate,
          focusSlot,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        billingUrl?: string;
        plan?: PlanWithRegen;
      };
      if (!res.ok) {
        setError(data.message || data.error || tt("common.error"));
        if (data.billingUrl) setBillingUrl(data.billingUrl);
        return;
      }
      if (data.plan) setPlan(data.plan);
    } catch {
      setError(tt("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!plan?.id || plan.id === "local-preview") return;
    if (!isPro) {
      setError(tt("common.proRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/meal-plan/favorites", {
        method: "POST",
        body: JSON.stringify({
          planId: plan.id,
          action: favorited ? "remove" : "add",
        }),
      });
      if (res.ok) setFavorited(!favorited);
      else {
        const data = (await res.json()) as { message?: string; billingUrl?: string };
        setError(data.message || tt("common.proRequired"));
        if (data.billingUrl) setBillingUrl(data.billingUrl);
      }
    } finally {
      setBusy(false);
    }
  }

  const payload: WeeklyMealPlanPayload | null = plan?.payload ?? null;
  const day = payload?.days?.[selectedDay];

  if (loading) {
    return (
      <p className="animate-plan-pulse text-ink-muted">{tt("common.loading")}</p>
    );
  }

  return (
    <section className="animate-fade-up space-y-6">
      <div>
        <h1 className="font-display text-4xl text-leaf-deep">
          {tt("brand.name")}
        </h1>
        <p className="text-sm uppercase tracking-[0.18em] text-coral">
          {tt("brand.nameEn")}
        </p>
        <p className="mt-2 text-ink-soft">{tt("plan.title")}</p>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm backdrop-blur">
        {isPro ? (
          <p className="text-leaf-deep">{tt("plan.pro")}</p>
        ) : (
          <>
            <p>
              {tt("plan.usage", undefined, {
                used,
                limit: FREE_MONTHLY_GENERATE_LIMIT,
              })}
            </p>
            <p className="mt-1 text-ink-muted">
              {tt("plan.freeLimit", undefined, {
                limit: FREE_MONTHLY_GENERATE_LIMIT,
                regen: FREE_REGENERATE_PER_PLAN,
              })}
            </p>
            <a
              href={billingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-coral underline-offset-2 hover:underline"
            >
              {tt("plan.upgrade")}
            </a>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="rounded-xl bg-leaf-deep px-4 py-2.5 text-white hover:bg-leaf disabled:opacity-60"
        >
          {busy ? tt("plan.loading") : tt("plan.generate")}
        </button>
        {plan && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void regenerate()}
              className="rounded-xl border border-leaf px-4 py-2.5 text-leaf-deep hover:bg-leaf-mist disabled:opacity-60"
            >
              {tt("plan.regenerate")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleFavorite()}
              className="rounded-xl border border-coral/40 px-4 py-2.5 text-coral hover:bg-coral-soft disabled:opacity-60"
            >
              {favorited ? tt("plan.favorited") : tt("plan.favorite")}
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      {!payload && (
        <p className="rounded-2xl border border-dashed border-ink/20 bg-white/40 p-8 text-center text-ink-muted">
          {tt("plan.empty")}
        </p>
      )}

      {payload && (
        <>
          <div className="rounded-2xl bg-leaf-deep px-4 py-3 text-sand">
            <p className="text-sm leading-relaxed">{payload.summary_text}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {payload.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-white/15 px-2 py-0.5 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-sand/70">
              {payload.targets.calories} kcal · P {payload.targets.protein}g · C{" "}
              {payload.targets.carbs}g · F {payload.targets.fats}g
              {typeof plan?.regenerateCount === "number" && (
                <> · regen {plan.regenerateCount}</>
              )}
            </p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {payload.days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDay(i)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm transition ${
                  selectedDay === i
                    ? "bg-leaf text-white"
                    : "bg-white/70 text-ink-soft hover:bg-leaf-mist"
                }`}
              >
                <span className="block font-medium">{d.day_label}</span>
                <span className="text-xs opacity-80">{d.date.slice(5)}</span>
              </button>
            ))}
          </div>

          {day && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-ink">
                  {day.day_label}
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void regenerate(day.date)}
                  className="text-sm text-leaf underline-offset-2 hover:underline"
                >
                  {tt("plan.regenDay")}
                </button>
              </div>

              {day.slots.map((slot) => (
                <article
                  key={`${day.date}-${slot.slot}`}
                  className="overflow-hidden rounded-2xl border border-ink/10 bg-white/80 shadow-sm"
                >
                  <div className="flex items-center justify-between bg-sand-warm/80 px-4 py-2">
                    <h3 className="font-medium text-ink">{slot.slot}</h3>
                    <div className="flex items-center gap-3 text-xs text-ink-muted">
                      <span>
                        {slot.estimated_calories} {tt("plan.kcal")}
                      </span>
                      <span>
                        {tt("plan.protein")} {slot.protein_g}g
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void regenerate(day.date, slot.slot)}
                        className="text-leaf hover:underline"
                      >
                        {tt("plan.regenSlot")}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-0 sm:grid-cols-2">
                    <div className="border-b border-ink/5 p-4 sm:border-b-0 sm:border-r">
                      <p className="text-xs font-semibold uppercase tracking-wider text-coral">
                        {tt("plan.eatOut")}
                      </p>
                      <p className="mt-1 font-medium text-ink">
                        {slot.eat_out.title}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {slot.eat_out.description}
                      </p>
                    </div>
                    <div className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-leaf">
                        {tt("plan.cook")}
                      </p>
                      <p className="mt-1 font-medium text-ink">
                        {slot.cook.title}
                      </p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {slot.cook.description}
                      </p>
                      {slot.cook.ingredients &&
                        slot.cook.ingredients.length > 0 && (
                          <ul className="mt-2 list-inside list-disc text-xs text-ink-muted">
                            {slot.cook.ingredients.map((ing) => (
                              <li key={ing}>{ing}</li>
                            ))}
                          </ul>
                        )}
                      {slot.cook.steps && slot.cook.steps.length > 0 && (
                        <ol className="mt-2 list-inside list-decimal text-xs text-ink-muted">
                          {slot.cook.steps.map((st) => (
                            <li key={st}>{st}</li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
