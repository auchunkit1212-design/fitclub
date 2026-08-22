import { getAppUrl } from "@/lib/site-url";
import {
  getOpenRouterVisionModelCandidates,
  normalizeImageBase64,
} from "@/lib/ocr-nutrition";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `你是一位專業的 InBody / 體脂計報告 OCR 專家。請從相片讀取身體組成報告（InBody、Tanita、Omron、健身房體脂磅等螢幕或紙本）。

請盡量抽取以下欄位（讀不到就填 null，唔好估數）：
- weight_kg：體重（公斤）
- body_fat_pct：體脂率 PBF / Body Fat（%）
- muscle_mass_kg：肌肉量 / Soft Lean Mass / 肌肉重量（公斤）；若報告只有骨骼肌量可留 null
- skeletal_muscle_kg：骨骼肌量 SMM（公斤）
- visceral_fat_level：內臟脂肪等級（數字，通常 1–20）
- bmr_kcal：基礎代謝 BMR（kcal）
- body_water_pct：體水分 TBW%（%）
- log_date：報告日期，格式 YYYY-MM-DD；讀唔到就 null
- device_hint：儀器品牌簡稱（例如 InBody、Tanita），讀唔到就 ""

注意：
- 只讀報告上寫明嘅數字，唔好用 BMI 反推。
- 體脂率若寫 22.5% 就回 22.5。
- 若相片唔係身體組成報告，全部數值填 null。

你必須【絕對嚴格】只回傳一個合法 JSON 物件，不要使用 Markdown，不要其他文字。
格式：{"weight_kg":72.4,"body_fat_pct":22.5,"muscle_mass_kg":30.1,"skeletal_muscle_kg":28.2,"visceral_fat_level":7,"bmr_kcal":1480,"body_water_pct":52.1,"log_date":"2026-08-20","device_hint":"InBody"}`;

export interface InBodyScanResult {
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  skeletalMuscleKg: number | null;
  visceralFatLevel: number | null;
  bmrKcal: number | null;
  bodyWaterPct: number | null;
  logDate: string | null;
  deviceHint: string;
}

export class InBodyScanError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "InBodyScanError";
    this.status = status;
  }
}

function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": getAppUrl(),
    "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "Nutrition Coach",
  };
}

function parseJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readNullableNumber(
  value: unknown,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return Math.round(n * 10) / 10;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readLogDate(value: unknown): string | null {
  const text = readText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const t = Date.parse(`${text}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return text;
}

export function toInBodyScanResult(raw: Record<string, unknown>): InBodyScanResult {
  return {
    weightKg: readNullableNumber(
      raw.weight_kg ?? raw.weightKg ?? raw.weight,
      20,
      300
    ),
    bodyFatPct: readNullableNumber(
      raw.body_fat_pct ?? raw.bodyFatPct ?? raw.pbf ?? raw.body_fat,
      1,
      70
    ),
    muscleMassKg: readNullableNumber(
      raw.muscle_mass_kg ?? raw.muscleMassKg ?? raw.soft_lean_mass_kg,
      5,
      120
    ),
    skeletalMuscleKg: readNullableNumber(
      raw.skeletal_muscle_kg ?? raw.skeletalMuscleKg ?? raw.smm,
      5,
      100
    ),
    visceralFatLevel: readNullableNumber(
      raw.visceral_fat_level ?? raw.visceralFatLevel ?? raw.vfl,
      0,
      30
    ),
    bmrKcal: (() => {
      const n = readNullableNumber(raw.bmr_kcal ?? raw.bmrKcal ?? raw.bmr, 500, 5000);
      return n == null ? null : Math.round(n);
    })(),
    bodyWaterPct: readNullableNumber(
      raw.body_water_pct ?? raw.bodyWaterPct ?? raw.tbw_pct,
      20,
      80
    ),
    logDate: readLogDate(raw.log_date ?? raw.logDate ?? raw.date),
    deviceHint: readText(raw.device_hint ?? raw.deviceHint ?? raw.device),
  };
}

export function isInBodyScanEmpty(result: InBodyScanResult): boolean {
  return (
    result.weightKg == null &&
    result.bodyFatPct == null &&
    result.muscleMassKg == null &&
    result.skeletalMuscleKg == null &&
    result.visceralFatLevel == null &&
    result.bmrKcal == null &&
    result.bodyWaterPct == null
  );
}

function parseVisionContent(data: {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}): InBodyScanResult {
  if (data.error?.message) {
    throw new InBodyScanError(`OpenRouter: ${data.error.message}`, 502);
  }
  const content = data.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new InBodyScanError("AI 未回傳 InBody 數據，請重新拍攝", 502);
  }
  return toInBodyScanResult(parseJsonObject(content));
}

async function requestOpenRouterVision(
  model: string,
  dataUrl: string,
  apiKey: string
): Promise<InBodyScanResult> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "請讀取這張 InBody／體脂報告相片並回傳 JSON。",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn(
      `[inbody-scan] openrouter ${model} error`,
      res.status,
      detail.slice(0, 300)
    );
    throw new InBodyScanError(
      res.status === 401
        ? "OpenRouter API 金鑰無效或未授權"
        : `OpenRouter ${model} 失敗 (${res.status})`,
      res.status === 401 ? 401 : res.status === 429 ? 429 : 502
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  return parseVisionContent(data);
}

async function requestOpenAiVision(dataUrl: string): Promise<InBodyScanResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new InBodyScanError("OPENAI_API_KEY 未設定", 503);
  }
  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "請讀取這張 InBody／體脂報告相片並回傳 JSON。",
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.warn("[inbody-scan] openai error", res.status, detail.slice(0, 300));
    throw new InBodyScanError(`OpenAI Vision 失敗 (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  return parseVisionContent(data);
}

/** OpenRouter 多模型重試 + OpenAI Vision 後備 */
export async function scanInBodyReport(
  imageBase64: string
): Promise<InBodyScanResult> {
  const dataUrl = normalizeImageBase64(imageBase64);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && !openAiKey) {
    throw new InBodyScanError(
      "AI InBody 辨識尚未設定，請在 Vercel 加入 OPENROUTER_API_KEY 或 OPENAI_API_KEY",
      503
    );
  }

  if (apiKey) {
    for (const model of getOpenRouterVisionModelCandidates()) {
      try {
        return await requestOpenRouterVision(model, dataUrl, apiKey);
      } catch (err) {
        if (err instanceof InBodyScanError && err.status === 401) {
          throw err;
        }
        console.warn(`[inbody-scan] ${model} skipped:`, err);
      }
    }
  }

  if (openAiKey) {
    try {
      return await requestOpenAiVision(dataUrl);
    } catch (err) {
      console.warn("[inbody-scan] openai fallback failed:", err);
      if (err instanceof InBodyScanError) throw err;
    }
  }

  throw new InBodyScanError("AI InBody 辨識服務暫時不可用，請稍後再試", 502);
}
