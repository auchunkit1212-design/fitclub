import { compressFileImage } from "@/lib/image";
import {
  isAllowedProfileAvatarUrl,
  removeProfileAvatarFromClient,
  uploadProfileAvatarFromClient,
} from "@/lib/profile-avatar-storage";
import {
  clearProfilePhotoUrl,
  getProfilePhotoUrl,
  notifyProfilePhotoUpdated,
  setProfilePhotoUrl,
} from "@/lib/profile-photo";
import { getSessionRequestHeaders } from "@/lib/session";

const publicAvatarCache = new Map<string, string | null>();

export async function fetchPublicAvatarUrl(
  email: string
): Promise<string | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;

  const local = getProfilePhotoUrl(key);
  if (local) return local;
  if (publicAvatarCache.has(key)) {
    return publicAvatarCache.get(key) ?? null;
  }

  try {
    const res = await fetch(
      `/api/users/avatar?email=${encodeURIComponent(key)}`
    );
    if (!res.ok) {
      publicAvatarCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as { avatarUrl?: string | null };
    const url = data.avatarUrl?.trim() || null;
    publicAvatarCache.set(key, url);
    if (url) setProfilePhotoUrl(key, url);
    return url;
  } catch {
    publicAvatarCache.set(key, null);
    return null;
  }
}

export async function syncProfilePhotoFromCloud(
  email: string
): Promise<string | null> {
  try {
    const res = await fetch("/api/me/avatar", {
      credentials: "include",
      headers: getSessionRequestHeaders(),
    });
    if (!res.ok) {
      return getProfilePhotoUrl(email);
    }
    const data = (await res.json()) as { avatarUrl?: string | null };
    const url = data.avatarUrl?.trim() || null;
    if (url) {
      setProfilePhotoUrl(email, url);
      notifyProfilePhotoUpdated(email);
      return url;
    }
    clearProfilePhotoUrl(email);
    notifyProfilePhotoUpdated(email);
    return null;
  } catch (err) {
    console.warn("[profile-avatar] cloud sync failed", err);
    return null;
  }
}

export async function uploadProfilePhotoToCloud(
  email: string,
  file: File
): Promise<string> {
  const dataUrl = await compressFileImage(file);
  let publicUrl: string;
  try {
    publicUrl = await uploadProfileAvatarFromClient(email, dataUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("STORAGE_BUCKET_MISSING")) {
      throw new Error("CLOUD_NOT_CONFIGURED");
    }
    throw err;
  }

  const res = await fetch("/api/me/avatar", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getSessionRequestHeaders(),
    },
    body: JSON.stringify({ avatarUrl: publicUrl }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "AVATAR_SAVE_FAILED");
  }

  const data = (await res.json()) as { avatarUrl?: string };
  const saved = data.avatarUrl?.trim() || publicUrl;
  if (!isAllowedProfileAvatarUrl(saved)) {
    throw new Error("INVALID_AVATAR_URL");
  }
  setProfilePhotoUrl(email, saved);
  notifyProfilePhotoUpdated(email);
  return saved;
}

export async function removeProfilePhotoFromCloud(email: string): Promise<void> {
  try {
    await removeProfileAvatarFromClient(email);
  } catch {
    // storage 可能已空，仍清除 DB
  }

  const res = await fetch("/api/me/avatar", {
    method: "DELETE",
    credentials: "include",
    headers: getSessionRequestHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "AVATAR_DELETE_FAILED");
  }

  clearProfilePhotoUrl(email);
  notifyProfilePhotoUpdated(email);
}
