export const COMMUNITY_MEDIA_BUCKET = "community-media";

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_MEDIA_DATA_URL");
  }
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });

  let ext = "bin";
  if (mime.includes("png")) ext = "png";
  else if (mime.includes("webp")) ext = "webp";
  else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
  else if (mime.includes("mp4")) ext = "mp4";
  else if (mime.includes("quicktime")) ext = "mov";
  else if (mime.includes("webm")) ext = "webm";

  return { blob, ext };
}

function storagePathForEmail(
  authorEmail: string,
  ext: string,
  mediaType: "image" | "video"
): string {
  const safeEmail = authorEmail
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "_");
  return `${safeEmail}/${mediaType}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export async function uploadCommunityMediaFromClient(
  authorEmail: string,
  dataUrl: string,
  mediaType: "image" | "video"
): Promise<string> {
  const { supabase } = await import("@/lib/supabase");
  const { blob, ext } = dataUrlToBlob(dataUrl);
  const path = storagePathForEmail(authorEmail, ext, mediaType);

  const { error } = await supabase.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    const msg = error.message ?? "unknown";
    if (msg.toLowerCase().includes("bucket") || msg.includes("not found")) {
      throw new Error(
        "STORAGE_BUCKET_MISSING: 請在 Supabase 執行 storage-community-media.sql"
      );
    }
    throw new Error(`COMMUNITY_MEDIA_UPLOAD_FAILED: ${msg}`);
  }

  const { data } = supabase.storage
    .from(COMMUNITY_MEDIA_BUCKET)
    .getPublicUrl(path);

  return data.publicUrl;
}

export function isRemoteCommunityMediaUrl(url?: string): boolean {
  if (!url?.trim()) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}
