import { supabase } from "@/lib/supabase";
import { toReadableError } from "@/lib/errors";
import type { BodyCompositionLog } from "@/lib/types";

type BodyCompositionLogRow = {
  id: string;
  email: string;
  log_date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  skeletal_muscle_kg: number | null;
  visceral_fat_level: number | null;
  bmr_kcal: number | null;
  body_water_pct: number | null;
  image_url: string | null;
  source: string;
  raw_ai_json: Record<string, unknown> | null;
  created_at: string;
};

export type UpsertBodyCompositionInput = {
  weightKg?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  skeletalMuscleKg?: number | null;
  visceralFatLevel?: number | null;
  bmrKcal?: number | null;
  bodyWaterPct?: number | null;
  imageUrl?: string | null;
  source?: string;
  rawAiJson?: Record<string, unknown> | null;
  logDate?: string;
};

function mapRow(row: BodyCompositionLogRow): BodyCompositionLog {
  return {
    id: row.id,
    email: row.email,
    logDate: row.log_date,
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    bodyFatPct: row.body_fat_pct == null ? null : Number(row.body_fat_pct),
    muscleMassKg: row.muscle_mass_kg == null ? null : Number(row.muscle_mass_kg),
    skeletalMuscleKg:
      row.skeletal_muscle_kg == null ? null : Number(row.skeletal_muscle_kg),
    visceralFatLevel:
      row.visceral_fat_level == null ? null : Number(row.visceral_fat_level),
    bmrKcal: row.bmr_kcal == null ? null : Number(row.bmr_kcal),
    bodyWaterPct: row.body_water_pct == null ? null : Number(row.body_water_pct),
    imageUrl: row.image_url,
    source: row.source,
    createdAt: row.created_at,
  };
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  const msg = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    msg.includes("body_composition_logs") ||
    msg.includes("schema cache")
  );
}

/** 過去 N 天（含今日）身體組成記錄，按日期升序 */
export async function fetchBodyCompositionLogsLastDays(
  email: string,
  days = 90
): Promise<BodyCompositionLog[]> {
  const normalized = email.trim().toLowerCase();
  const fromDate = daysAgoIso(days - 1);

  const { data, error } = await supabase
    .from("body_composition_logs")
    .select("*")
    .eq("email", normalized)
    .gte("log_date", fromDate)
    .order("log_date", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw toReadableError(error, "讀取 InBody 記錄失敗");
  }

  return (data as BodyCompositionLogRow[]).map(mapRow);
}

/** 新增或更新指定日期（預設今日）的身體組成 */
export async function upsertBodyCompositionLog(
  email: string,
  input: UpsertBodyCompositionInput
): Promise<BodyCompositionLog> {
  const normalized = email.trim().toLowerCase();
  const logDate = input.logDate?.trim() || todayIsoDate();

  const { data, error } = await supabase
    .from("body_composition_logs")
    .upsert(
      {
        email: normalized,
        log_date: logDate,
        weight_kg: input.weightKg ?? null,
        body_fat_pct: input.bodyFatPct ?? null,
        muscle_mass_kg: input.muscleMassKg ?? null,
        skeletal_muscle_kg: input.skeletalMuscleKg ?? null,
        visceral_fat_level: input.visceralFatLevel ?? null,
        bmr_kcal: input.bmrKcal ?? null,
        body_water_pct: input.bodyWaterPct ?? null,
        image_url: input.imageUrl ?? null,
        source: input.source ?? "inbody_ocr",
        raw_ai_json: input.rawAiJson ?? null,
      },
      { onConflict: "email,log_date" }
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        "尚未建立 body_composition_logs 資料表，請在 Supabase 執行 body-composition-logs.sql"
      );
    }
    throw toReadableError(error, "儲存 InBody 記錄失敗");
  }

  return mapRow(data as BodyCompositionLogRow);
}
