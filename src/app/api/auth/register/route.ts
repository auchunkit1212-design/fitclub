import { NextRequest, NextResponse } from "next/server";
import { registerPublicUser } from "@/lib/auth-register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      role?: "coach" | "student";
      email?: string;
      password?: string;
      name?: string;
      gymName?: string;
      inviteCode?: string;
    };

    if (body.role !== "coach" && body.role !== "student") {
      return NextResponse.json({ error: "請選擇註冊身份" }, { status: 400 });
    }

    const { session, tenant } = await registerPublicUser({
      role: body.role,
      email: body.email ?? "",
      password: body.password ?? "",
      name: body.name ?? "",
      gymName: body.gymName,
      inviteCode: body.inviteCode,
    });

    const response = NextResponse.json({
      ok: true,
      session,
      tenantSlug: tenant?.slug,
      gymName: tenant?.gymName,
    });
    response.cookies.set("current_session", JSON.stringify(session), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "註冊失敗";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
