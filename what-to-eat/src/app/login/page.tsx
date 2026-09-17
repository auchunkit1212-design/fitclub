"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { saveSession } from "@/lib/session";
import type { UserSession } from "@/lib/types";

export default function LoginPage() {
  const { tt } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        session?: UserSession;
      };
      if (!res.ok || !data.session) {
        setError(data.error || tt("login.error"));
        return;
      }
      saveSession(data.session);
      router.push("/");
    } catch {
      setError(tt("login.error"));
    } finally {
      setLoading(false);
    }
  }

  const registerUrl =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_MAIN_APP_REGISTER_URL ||
        "http://localhost:3000/register"
      : "http://localhost:3000/register";

  return (
    <section className="animate-fade-up mx-auto max-w-md">
      <div className="mb-8 text-center">
        <h1 className="font-display text-5xl font-semibold text-leaf-deep">
          {tt("brand.name")}
        </h1>
        <p className="mt-1 text-sm uppercase tracking-[0.2em] text-coral">
          {tt("brand.nameEn")}
        </p>
        <p className="mt-4 text-ink-soft">{tt("brand.hero")}</p>
        <p className="mt-2 text-sm text-ink-muted">{tt("brand.sub")}</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-ink/10 bg-white/70 p-6 shadow-sm backdrop-blur"
      >
        <h2 className="font-display text-xl text-ink">{tt("login.title")}</h2>
        <p className="text-sm text-ink-muted">{tt("login.subtitle")}</p>

        <label className="block text-sm">
          <span className="text-ink-soft">{tt("login.email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2.5 outline-none ring-leaf focus:ring-2"
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-soft">{tt("login.password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/15 bg-sand px-3 py-2.5 outline-none ring-leaf focus:ring-2"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-leaf-deep py-3 font-medium text-white transition hover:bg-leaf disabled:opacity-60"
        >
          {loading ? tt("common.loading") : tt("login.submit")}
        </button>

        <a
          href={registerUrl}
          className="block text-center text-sm text-leaf underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          {tt("login.registerHint")}
        </a>
      </form>

      <p className="mt-6 text-center text-xs text-ink-muted">
        <Link href="/">{tt("brand.tagline")}</Link>
      </p>
    </section>
  );
}
