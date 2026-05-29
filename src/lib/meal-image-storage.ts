import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MEAL_IMAGES_BUCKET = "food-images";

function parseDataUrl(dataUrl: string): {
  contentType: string;
  buffer: Buffer;
  ext: string;
} {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA_URL");
  }
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  return { contentType, buffer, ext };
}

/** 伺服器端：壓縮後的 data URL → Supabase Storage → 公開 URL */
export async function uploadMealImageToStorage(
  studentEmail: string,
  dataUrl: string
): Promise<string> {
  const admin = getSupabaseAdmin();
  const { contentType, buffer, ext } = parseDataUrl(dataUrl);
  const safeEmail = studentEmail.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  const path = `${safeEmail}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await admin.storage
    .from(MEAL_IMAGES_BUCKET)
    .upload(path, buffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(`STORAGE_UPLOAD_FAILED: ${error.message}`);
  }

  const { data } = admin.storage.from(MEAL_IMAGES_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("STORAGE_PUBLIC_URL_FAILED");
  }
  return data.publicUrl;
}
