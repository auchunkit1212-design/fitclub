/** Normalize Supabase / fetch errors into readable Error messages */
export function toReadableError(error: unknown, fallback = "操作失敗"): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object") {
    const obj = error as { message?: string; error?: string; hint?: string; code?: string };
    const parts = [obj.message ?? obj.error, obj.hint, obj.code].filter(Boolean);
    if (parts.length > 0) return new Error(parts.join(" · "));
  }
  return new Error(fallback);
}

export function errorMessage(error: unknown, fallback = "操作失敗"): string {
  return toReadableError(error, fallback).message;
}
