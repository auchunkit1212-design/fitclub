import imageCompression from "browser-image-compression";

const COMPRESS_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
};

export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("READ_FILE_FAILED"));
    };
    reader.onerror = () => reject(new Error("READ_FILE_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToFile(
  dataUrl: string,
  filename = "meal-photo.jpg"
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, {
    type: blob.type || "image/jpeg",
  });
}

/** 使用 browser-image-compression 壓縮相片（≤1MB、最長邊 1024px） */
export async function compressFileImage(file: File): Promise<string> {
  const compressed = await imageCompression(file, COMPRESS_OPTIONS);
  return fileToDataUrl(compressed);
}

/** 將既有 data URL 再壓縮（上傳前保險） */
export async function compressDataUrl(
  dataUrl: string,
  _maxWidth?: number,
  _quality?: number
): Promise<string> {
  const file = await dataUrlToFile(dataUrl);
  return compressFileImage(file);
}
