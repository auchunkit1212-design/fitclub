export interface NutritionLabelResult {
  productName: string;
  caloriesPerServing: number;
  servingSize: string;
  servingsPerPackage: number;
  caloriesPerPiece: number;
  protein: number;
  carbs: number;
  fats: number;
  notes: string;
  source: "openai" | "mock";
}

const LABEL_PROMPT = `你是營養標籤 OCR 專家。分析包裝營養標籤相片，回覆純 JSON（不要 markdown）：
{
  "productName": "產品名",
  "caloriesPerServing": 每份熱量數字,
  "servingSize": "每份份量描述",
  "servingsPerPackage": 每包份數數字,
  "protein": 每份蛋白質g,
  "carbs": 每份碳水g,
  "fats": 每份脂肪g,
  "notes": "簡短說明"
}
若無法辨識，合理估算香港常見零食包裝並在 notes 說明。`;

export async function scanNutritionLabel(
  imageBase64: string
): Promise<NutritionLabelResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4o";

  if (!apiKey) {
    return mockLabelScan();
  }

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: LABEL_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision API 失敗: ${err.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  const parsed = parseLabelJson(text);
  const servings = Math.max(1, Number(parsed.servingsPerPackage) || 1);
  const perServing = Math.max(1, Number(parsed.caloriesPerServing) || 100);

  return {
    productName: String(parsed.productName ?? "包裝食品"),
    caloriesPerServing: perServing,
    servingSize: String(parsed.servingSize ?? "1 份"),
    servingsPerPackage: servings,
    caloriesPerPiece: Math.round(perServing / servings),
    protein: Math.round(Number(parsed.protein) || 0),
    carbs: Math.round(Number(parsed.carbs) || 0),
    fats: Math.round(Number(parsed.fats) || 0),
    notes: String(parsed.notes ?? ""),
    source: "openai",
  };
}

function parseLabelJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function mockLabelScan(): NutritionLabelResult {
  return {
    productName: "示範零食（未設定 OPENAI_API_KEY）",
    caloriesPerServing: 480,
    servingSize: "每包 40g",
    servingsPerPackage: 6,
    caloriesPerPiece: 80,
    protein: 6,
    carbs: 52,
    fats: 18,
    notes: "請設定 OPENAI_API_KEY 以啟用真實 OCR",
    source: "mock",
  };
}
