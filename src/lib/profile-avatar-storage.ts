export const PROFILE_AVATARS_BUCKET = "profile-avatars";

function dataUrlToBlob(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA_URL");
  }
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function avatarStoragePathForEmail(studentEmail: string): string {
  const safeEmail = studentEmail
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "_");
  return `avatars/${safeEmail}/avatar.jpg`;
}

/** 前端直傳 profile-avatars（anon key + upsert 覆蓋舊頭像） */
export async function uploadProfileAvatarFromClient(
  studentEmail: string,
  dataUrl: string
): Promise<string> {
  const { supabase } = await import("@/lib/supabase");

  const blob = dataUrlToBlob(dataUrl);
  const path = avatarStoragePathForEmail(studentEmail);

  const { error } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      cacheControl: "3600",
      upsert: true,
    });

  if (error) {
    const msg = error.message ?? "unknown";
    if (msg.toLowerCase().includes("bucket") || msg.includes("not found")) {
      throw new Error(
        "STORAGE_BUCKET_MISSING: 請在 Supabase 執行 profile-avatar-cloud.sql"
      );
    }
    if (
      msg.toLowerCase().includes("row-level security") ||
      msg.includes("policy")
    ) {
      throw new Error(
        "STORAGE_RLS_DENIED: Storage RLS 拒絕上傳，請執行 profile-avatar-cloud.sql"
      );
    }
    throw new Error(`STORAGE_UPLOAD_FAILED: ${msg}`);
  }

  const { data } = supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("STORAGE_PUBLIC_URL_FAILED");
  }
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeProfileAvatarFromClient(
  studentEmail: string
): Promise<void> {
  const { supabase } = await import("@/lib/supabase");
  const path = avatarStoragePathForEmail(studentEmail);
  const { error } = await supabase.storage
    .from(PROFILE_AVATARS_BUCKET)
    .remove([path]);
  if (error) {
    console.warn("[profile-avatar] storage remove failed", error.message);
  }
}

/** 只接受 profile-avatars bucket 的公開 URL（防濫用） */
export function isAllowedProfileAvatarUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const path = u.pathname.toLowerCase();
    return path.includes(`/object/public/${PROFILE_AVATARS_BUCKET}/`);
  } catch {
    return false;
  }
}
