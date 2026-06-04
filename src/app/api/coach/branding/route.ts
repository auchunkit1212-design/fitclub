import { NextResponse } from "next/server";
import { updateCoachBrandingAdmin } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";
import type { ThemeColor } from "@/lib/types";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email || session.role !== "coach") {
    return NextResponse.json({ error: "僅教練可發布品牌設定" }, { status: 403 });
  }

  const body = (await request.json()) as {
    appTitle?: string;
    themeColor?: ThemeColor;
    logo?: string;
    broadcast?: string;
    tenantId?: string;
  };

  try {
    await updateCoachBrandingAdmin(session.email, {
      appTitle: body.appTitle?.trim() || "Nutrition Coach",
      themeColor: body.themeColor ?? "emerald",
      logo: body.logo,
      broadcast: body.broadcast?.trim() ?? "",
      tenantId: body.tenantId ?? session.tenantId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const readable = toReadableError(error, "雲端發布失敗");
    const hint =
      error &&
      typeof error === "object" &&
      "hint" in error &&
      typeof (error as { hint: string }).hint === "string"
        ? (error as { hint: string }).hint
        : "請在 Supabase 執行 supabase/fix-users-registry-broadcast.sql（及 fix-tenants-branding.sql）";
    console.error("[coach/branding] publish failed:", readable.message, error);
    return NextResponse.json(
      {
        error: readable.message,
        hint,
      },
      { status: 500 }
    );
  }
}
