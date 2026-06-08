import {
  getOpenRouterVisionModelCandidates,
  normalizeImageBase64,
  OcrNutritionError,
} from "@/lib/ocr-nutrition";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const BARCODE_SYSTEM_PROMPT = `你是商品條碼辨識專家。從相片讀取條碼數字（EAN-13、EAN-8、UPC-A 等）。

規則：
1. 只輸出條碼數字，不可有空格或連字號。
2. 若為 UPC-A（12 位）可照讀；EAN-13 為 13 位。
3. 若相片模糊、無條碼或無法辨識，barcode 填 ""。

你必須【絕對嚴格】只回傳合法 JSON，不要 Markdown：
{"barcode":"8712345678901","format":"EAN-13"}`;

export type BarcodeScanResult = {
  barcode: string;
  format: string;
};

function getOpenRouterHeaders(apiKey: string): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk";
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "Nutrition Coach",
  };
}

function normalizeBarcodeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12) {
    return `0${digits}`;
  }
  return digits;
}

function isPlausibleBarcode(barcode: string): boolean {
  return (
    barcode.length === 8 ||
    barcode.length === 12 ||
    barcode.length === 13 ||
    barcode.length === 14
  );
}

function parseBarcodeJson(text: string): BarcodeScanResult {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return { barcode: "", format: "unknown" };

  const raw = JSON.parse(match[0]) as Record<string, unknown>;
  const barcode = normalizeBarcodeDigits(String(raw.barcode ?? "").trim());
  const format = String(raw.format ?? "unknown").trim() || "unknown";

  if (!barcode || !isPlausibleBarcode(barcode)) {
    return { barcode: "", format: "unknown" };
  }

  return { barcode, format };
}

async function requestOpenRouterBarcodeVision(
  model: string,
  dataUrl: string,
  apiKey: string
): Promise<BarcodeScanResult> {
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: getOpenRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      temperature: 0.05,
      max_tokens: 120,
      messages: [
        { role: "system", content: BARCODE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "請讀取這張相片中的商品條碼數字並回傳 JSON。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new OcrNutritionError(`OpenRouter 條碼辨識失敗 (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new OcrNutritionError(`OpenRouter: ${data.error.message}`, 502);
  }

  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseBarcodeJson(content);
  if (!parsed.barcode) {
    throw new OcrNutritionError(
      "睇唔清楚條碼，請對準條碼再影一次（避免反光同模糊）",
      422
    );
  }

  return parsed;
}

async function requestOpenAiBarcodeVision(
  dataUrl: string
): Promise<BarcodeScanResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OcrNutritionError("OPENAI_API_KEY 未設定", 503);
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
      temperature: 0.05,
      max_tokens: 120,
      messages: [
        { role: "system", content: BARCODE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "請讀取這張相片中的商品條碼數字並回傳 JSON。" },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new OcrNutritionError(`OpenAI 條碼辨識失敗 (${res.status})`, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseBarcodeJson(content);
  if (!parsed.barcode) {
    throw new OcrNutritionError(
      "睇唔清楚條碼，請對準條碼再影一次（避免反光同模糊）",
      422
    );
  }

  return parsed;
}

export async function scanBarcodeFromImage(
  imageBase64: string
): Promise<BarcodeScanResult> {
  const dataUrl = normalizeImageBase64(imageBase64);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey && !openAiKey) {
    throw new OcrNutritionError(
      "條碼辨識尚未設定，請加入 OPENROUTER_API_KEY 或 OPENAI_API_KEY",
      503
    );
  }

  if (apiKey) {
    for (const model of getOpenRouterVisionModelCandidates()) {
      try {
        return await requestOpenRouterBarcodeVision(model, dataUrl, apiKey);
      } catch (err) {
        if (err instanceof OcrNutritionError && err.status === 422) throw err;
        console.warn(`[barcode-scan] ${model} skipped:`, err);
      }
    }
  }

  if (openAiKey) {
    return requestOpenAiBarcodeVision(dataUrl);
  }

  throw new OcrNutritionError("條碼辨識服務暫時不可用", 502);
}
