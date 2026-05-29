import { NextRequest, NextResponse } from "next/server";
import { emailExists } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { createTenantWithCoach } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      gymName?: string;
    };

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const gymName = body.gymName?.trim() ?? "";

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: "請填寫 Email，密碼至少 6 位。" },
        { status: 400 }
      );
    }
    if (!gymName) {
      return NextResponse.json(
        { error: "請填寫 Gym 房 / 教練名稱。" },
        { status: 400 }
      );
    }

    if (await emailExists(email)) {
      return NextResponse.json(
        { error: "此 Email 已被註冊，請直接登入。" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const { tenant } = await createTenantWithCoach({
      email,
      passwordHash,
      gymName,
    });

    return NextResponse.json({
      ok: true,
      tenantSlug: tenant.slug,
      gymName: tenant.gymName,
      message: "租戶已建立，請前往登入頁使用 Email 與密碼登入。",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "註冊失敗，請稍後再試。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
