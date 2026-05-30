/** Supabase Storage bucket for meal photos */
export const MEAL_IMAGES_BUCKET = "food-images";

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

function storagePathForEmail(studentEmail: string, ext: string): string {
  const safeEmail = studentEmail
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "_");
  return `${safeEmail}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/**
 * 前端直傳 Supabase Storage（使用 supabase-js + anon key，非 service role）
 */
export async function uploadMealImageFromClient(
  studentEmail: string,
  dataUrl: string
): Promise<string> {
  const { supabase } = await import("@/lib/supabase");

  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type.includes("png")
    ? "png"
    : blob.type.includes("webp")
      ? "webp"
      : "jpg";
  const path = storagePathForEmail(studentEmail, ext);

  const { error } = await supabase.storage
    .from(MEAL_IMAGES_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || "image/jpeg",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    const msg = error.message ?? "unknown";
    if (msg.toLowerCase().includes("bucket") || msg.includes("not found")) {
      throw new Error(
        "STORAGE_BUCKET_MISSING: 請在 Supabase 執行 storage-food-images.sql"
      );
    }
    if (msg.toLowerCase().includes("row-level security") || msg.includes("policy")) {
      throw new Error(
        "STORAGE_RLS_DENIED: Storage RLS 拒絕上傳，請執行 storage-food-images.sql"
      );
    }
    throw new Error(`STORAGE_UPLOAD_FAILED: ${msg}`);
  }

  const { data } = supabase.storage.from(MEAL_IMAGES_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("STORAGE_PUBLIC_URL_FAILED");
  }
  return data.publicUrl;
}
