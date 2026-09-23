"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import {
  removeProfilePhotoFromCloud,
  syncProfilePhotoFromCloud,
  uploadProfilePhotoToCloud,
} from "@/lib/profile-avatar-client";
import {
  getProfilePhotoUrl,
  PROFILE_PHOTO_SYNC_EVENT,
} from "@/lib/profile-photo";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  email: string;
  displayName: string;
  size?: "md" | "lg";
  onPhotoChange?: (url: string | null) => void;
};

export function ProfileAvatar({
  email,
  displayName,
  size = "lg",
  onPhotoChange,
}: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(() =>
    typeof window !== "undefined" ? getProfilePhotoUrl(email) : null
  );
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const dim = size === "lg" ? "w-14 h-14" : "w-10 h-10";
  const textSize = size === "lg" ? "text-lg" : "text-sm";
  const initial = displayName.trim().slice(0, 1) || "?";

  const applyPhoto = (url: string | null) => {
    setPhotoUrl(url);
    onPhotoChange?.(url);
  };

  useEffect(() => {
    const normalized = email.trim().toLowerCase();
    let cancelled = false;
    setSyncing(true);
    void syncProfilePhotoFromCloud(email).then((url) => {
      if (cancelled) return;
      if (url !== null) applyPhoto(url);
      else applyPhoto(getProfilePhotoUrl(email));
      setSyncing(false);
    });

    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ email?: string }>).detail;
      if (detail?.email === normalized) {
        applyPhoto(getProfilePhotoUrl(email));
      }
    };
    window.addEventListener(PROFILE_PHOTO_SYNC_EVENT, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_PHOTO_SYNC_EVENT, onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- email identity only
  }, [email]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadProfilePhotoToCloud(email, file);
      applyPhoto(url);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "CLOUD_NOT_CONFIGURED") {
        alert(
          t(
            "profile.photo.cloudNotReady",
            "雲端頭像尚未設定，請在 Supabase 執行 profile-avatar-cloud.sql"
          )
        );
        return;
      }
      alert(t("profile.photo.fail", "相片處理失敗，請再試"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeProfilePhotoFromCloud(email);
      applyPhoto(null);
    } catch {
      alert(t("profile.photo.fail", "相片處理失敗，請再試"));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || syncing;

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={`relative ${dim} rounded-full overflow-hidden ring-2 ring-emerald-100 bg-emerald-600 text-white font-bold flex items-center justify-center ${btnClass} disabled:opacity-60`}
        aria-label={t("profile.photo.change", "更換頭像")}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={textSize}>{initial}</span>
        )}
        <span className="absolute bottom-0 inset-x-0 h-5 bg-black/45 flex items-center justify-center">
          <Camera size={12} className="text-white" strokeWidth={2} aria-hidden />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex gap-2 text-[10px] font-semibold">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={`text-emerald-700 ${btnClass}`}
        >
          {busy || syncing
            ? t("profile.photo.uploading", "上傳中…")
            : t("profile.photo.upload", "上傳相片")}
        </button>
        {photoUrl && (
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={disabled}
            className={`text-zinc-500 ${btnClass}`}
          >
            {t("profile.photo.remove", "移除")}
          </button>
        )}
      </div>
    </div>
  );
}
