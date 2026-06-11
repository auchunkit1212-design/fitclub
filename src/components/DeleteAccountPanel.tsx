"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { clearSession, getSession, getSessionRequestHeaders } from "@/lib/session";
import type { UserSession } from "@/lib/types";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

export function DeleteAccountPanel() {
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<UserSession | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSession(getSession());
  }, []);

  const expectedConfirm = session?.email?.trim().toLowerCase() ?? "";
  const canDelete =
    Boolean(expectedConfirm) &&
    confirmText.trim().toLowerCase() === expectedConfirm;

  const handleDelete = async () => {
    if (!canDelete || loading) return;
    const ok = window.confirm(
      t(
        "legal.deleteConfirmDialog",
        "此操作無法復原。確定永久刪除帳戶及所有飲食記錄？"
      )
    );
    if (!ok) return;

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/me/delete-account", {
        method: "DELETE",
        credentials: "include",
        headers: getSessionRequestHeaders(),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? t("legal.deleteFailed", "刪除失敗"));
      }
      clearSession();
      alert(t("legal.deleteSuccess", "帳戶已永久刪除。"));
      router.replace("/register");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("legal.deleteFailed", "刪除失敗"));
    } finally {
      setLoading(false);
    }
  };

  if (!session?.email) {
    return (
      <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
        <p className="text-sm text-zinc-600">
          {t("legal.deleteLoginRequired", "請先登入再刪除帳戶。")}
        </p>
        <button
          type="button"
          onClick={() => router.push("/register")}
          className={`w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl ${btnClass}`}
        >
          {t("legal.goLogin", "前往登入")}
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-red-100 bg-red-50/50 p-4 space-y-4">
      <div>
        <h2 className="font-semibold text-red-800">
          {t("legal.deleteTitle", "永久刪除帳戶")}
        </h2>
        <p className="text-sm text-red-900/80 mt-2 leading-relaxed">
          {t(
            "legal.deleteWarning",
            "刪除後將移除你的帳戶、飲食記錄、身體檔案、推播訂閱同相關資料，且無法復原。"
          )}
        </p>
        {session.role === "coach" && (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3 leading-relaxed">
            {t(
              "legal.deleteCoachWarning",
              "教練帳戶刪除後，學員將無法再透過你的邀請碼綁定；已綁定學員資料唔會一併刪除。"
            )}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-600">
          {t("legal.deleteTypeEmail", "輸入你的電郵以確認：{email}", {
            email: session.email,
          })}
        </label>
        <input
          type="email"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-base bg-white"
          placeholder={session.email}
        />
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-100 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canDelete || loading}
        onClick={() => void handleDelete()}
        className={`w-full bg-red-600 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 ${btnClass}`}
      >
        {loading
          ? t("legal.deleting", "刪除中...")
          : t("legal.deleteButton", "永久刪除我的帳戶")}
      </button>
    </section>
  );
}
