"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Globe, Image as ImageIcon, Loader2, Video } from "@/components/icons";
import { useI18n } from "@/components/I18nProvider";
import { compressFileImage, fileToDataUrl } from "@/lib/image";
import { publishThoughtPost, validateVideoFile } from "@/lib/community";
import { syncProfilePhotoFromCloud } from "@/lib/profile-avatar-client";
import {
  getProfilePhotoUrl,
  PROFILE_PHOTO_SYNC_EVENT,
} from "@/lib/profile-photo";
import type { UserSession } from "@/lib/types";

const SOFT_CARD =
  "rounded-3xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100";

const btnClass =
  "active:scale-95 active:opacity-80 transition-all cursor-pointer";

type Props = {
  session: UserSession;
  onPosted: () => void;
};

export function CommunityComposer({ session, onPosted }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const displayName = session.name?.trim() || session.email.split("@")[0];
  const initials =
    displayName.slice(0, 2) || session.email.slice(0, 2).toUpperCase();
  const [avatarPhoto, setAvatarPhoto] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () =>
      setAvatarPhoto(getProfilePhotoUrl(session.email));
    refresh();
    void syncProfilePhotoFromCloud(session.email).then((url) => {
      setAvatarPhoto(url ?? getProfilePhotoUrl(session.email));
    });
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<{ email?: string }>).detail;
      if (
        detail?.email === session.email.trim().toLowerCase()
      ) {
        refresh();
      }
    };
    window.addEventListener(PROFILE_PHOTO_SYNC_EVENT, onSync);
    return () => window.removeEventListener(PROFILE_PHOTO_SYNC_EVENT, onSync);
  }, [session.email]);

  const clearMedia = () => {
    setMediaPreview(null);
    setMediaType(null);
  };

  const handleImageFile = async (file: File) => {
    setError(null);
    try {
      const dataUrl = await compressFileImage(file);
      setMediaPreview(dataUrl);
      setMediaType("image");
    } catch {
      setError(t("community.composer.imageFail", "相片處理失敗"));
    }
  };

  const handleVideoFile = async (file: File) => {
    setError(null);
    const validation = validateVideoFile(file);
    if (validation) {
      setError(validation);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setMediaPreview(dataUrl);
      setMediaType("video");
    } catch {
      setError(t("community.composer.videoFail", "影片讀取失敗"));
    }
  };

  const canPost = Boolean(text.trim() || mediaPreview);

  const handlePost = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    setError(null);
    try {
      publishThoughtPost({
        session,
        bodyText: text,
        mediaType: mediaType ?? undefined,
        mediaUrl: mediaPreview ?? undefined,
      });
      setText("");
      clearMedia();
      onPosted();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "STORAGE_FULL") {
        setError(
          t(
            "community.composer.storageFull",
            "儲存空間已滿，請刪除部分媒體或縮短影片"
          )
        );
      } else {
        setError(t("community.composer.postFail", "發布失敗，請稍後再試"));
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className={`${SOFT_CARD} p-4 space-y-3 min-w-0`}>
      <div className="flex gap-3 min-w-0">
        <div
          className="w-10 h-10 shrink-0 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center overflow-hidden"
          aria-hidden
        >
          {avatarPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={t(
            "community.composer.placeholder",
            "分享你嘅想法、飲食心得…"
          )}
          className="flex-1 min-w-0 resize-none rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
      </div>

      {mediaPreview && mediaType === "image" && (
        <div className="relative rounded-2xl overflow-hidden bg-gray-100 max-h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaPreview}
            alt=""
            className="w-full max-h-48 object-cover"
          />
          <button
            type="button"
            onClick={clearMedia}
            className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
          >
            {t("common.remove", "移除")}
          </button>
        </div>
      )}

      {mediaPreview && mediaType === "video" && (
        <div className="relative rounded-2xl overflow-hidden bg-black max-h-48">
          <video
            src={mediaPreview}
            controls
            className="w-full max-h-48 object-contain"
          />
          <button
            type="button"
            onClick={clearMedia}
            className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full"
          >
            {t("common.remove", "移除")}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-600 leading-relaxed">{error}</p>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImageFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImageFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleVideoFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className={`p-2 rounded-xl text-emerald-700 hover:bg-emerald-50 ${btnClass}`}
            aria-label={t("community.composer.camera", "拍照")}
          >
            <Camera size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className={`p-2 rounded-xl text-emerald-700 hover:bg-emerald-50 ${btnClass}`}
            aria-label={t("community.composer.photo", "相片")}
          >
            <ImageIcon size={20} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className={`p-2 rounded-xl text-emerald-700 hover:bg-emerald-50 ${btnClass}`}
            aria-label={t("community.composer.video", "影片")}
          >
            <Video size={20} strokeWidth={2} />
          </button>
        </div>

        <button
          type="button"
          disabled={!canPost || posting}
          onClick={() => void handlePost()}
          className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold disabled:opacity-40 ${btnClass}`}
        >
          {posting ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <Globe size={16} strokeWidth={2} aria-hidden />
          )}
          {t("community.composer.post", "發布")}
        </button>
      </div>
    </section>
  );
}
