const DEFAULT_MODEL = "deepseek/deepseek-chat";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export function getOpenRouterReferer(): string {
  return (
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://fitclub.hk"
  );
}

export async function openRouterChatJson(params: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string | null> {
  if (!isOpenRouterConfigured()) return null;
  const apiKey = process.env.OPENROUTER_API_KEY!.trim();
  const res = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": getOpenRouterReferer(),
      "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "What to Eat",
    },
    body: JSON.stringify({
      model: getOpenRouterModel(),
      temperature: params.temperature ?? 0.7,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn("[openrouter] failed", res.status, text.slice(0, 300));
    return null;
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}
