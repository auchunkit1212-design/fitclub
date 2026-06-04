const STORAGE_KEY = "fitclub_profile_photos_v1";

export const PROFILE_PHOTO_SYNC_EVENT = "fitclub-profile-photo-sync";

export function notifyProfilePhotoUpdated(email: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROFILE_PHOTO_SYNC_EVENT, {
      detail: { email: normalizeEmail(email) },
    })
  );
}

type PhotoStore = Record<string, string>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function readStore(): PhotoStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PhotoStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: PhotoStore): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("[profile-photo] localStorage write failed", err);
    throw new Error("STORAGE_FULL");
  }
}

export function getProfilePhotoUrl(email: string): string | null {
  const key = normalizeEmail(email);
  if (!key) return null;
  return readStore()[key] ?? null;
}

export function setProfilePhotoUrl(email: string, dataUrl: string): void {
  const key = normalizeEmail(email);
  if (!key || !dataUrl) return;
  const store = readStore();
  store[key] = dataUrl;
  writeStore(store);
}

export function clearProfilePhotoUrl(email: string): void {
  const key = normalizeEmail(email);
  if (!key) return;
  const store = readStore();
  delete store[key];
  writeStore(store);
}
