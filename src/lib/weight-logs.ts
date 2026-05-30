import { supabase } from "@/lib/supabase";
import { toReadableError } from "@/lib/errors";
import type { WeightLog } from "@/lib/types";

type WeightLogRow = {
  id: string;
  email: string;
  weight_kg: number;
  log_date: string;
  created_at: string;
};

function mapWeightLog(row: WeightLogRow): WeightLog {
  return {
    id: row.id,
    email: row.email,
    weightKg: Number(row.weight_kg),
    logDate: row.log_date,
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
    msg.includes("weight_logs") ||
    msg.includes("schema cache")
  );
}

/** 過去 N 天（含今日）體重記錄，按日期升序 */
export async function fetchWeightLogsLastDays(
  email: string,
  days = 7
): Promise<WeightLog[]> {
  const normalized = email.trim().toLowerCase();
  const fromDate = daysAgoIso(days - 1);

  const { data, error } = await supabase
    .from("weight_logs")
    .select("*")
    .eq("email", normalized)
    .gte("log_date", fromDate)
    .order("log_date", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw toReadableError(error, "讀取體重記錄失敗");
  }

  return (data as WeightLogRow[]).map(mapWeightLog);
}

/** 新增或更新指定日期（預設今日）的體重 */
export async function upsertWeightLog(
  email: string,
  weightKg: number,
  logDate = todayIsoDate()
): Promise<WeightLog> {
  const normalized = email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        email: normalized,
        weight_kg: weightKg,
        log_date: logDate,
      },
      { onConflict: "email,log_date" }
    )
    .select("*")
    .single();

  if (error) throw toReadableError(error, "儲存體重失敗");
  return mapWeightLog(data as WeightLogRow);
}
