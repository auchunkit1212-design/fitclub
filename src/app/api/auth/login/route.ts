import { NextRequest, NextResponse } from "next/server";
import { loginWithCredentials } from "@/lib/auth";
import { sanitizeSessionForApi } from "@/lib/session-sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let body: { email?: string; password?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "請求格式錯誤。" }, { status: 400 });
    }

    const email = body.email?.trim() ?? "";
    const password = body.password;

    if (!email) {
      return NextResponse.json({ error: "請輸入 Email。" }, { status: 400 });
    }

    const session = sanitizeSessionForApi(await loginWithCredentials(email, password));

    const response = NextResponse.json({ ok: true, session });
    try {
      response.cookies.set("current_session", JSON.stringify(session), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    } catch (cookieErr) {
      console.warn("[login] cookie set failed:", cookieErr);
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "登入失敗";
    console.error("Login failed:", message, error);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
