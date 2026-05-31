import { NextResponse } from "next/server";
import { emailExists } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { createPartnerTenantWithCoach } from "@/lib/tenant";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "需要平台管理員權限" }, { status: 403 });
  }

  let body: {
    brandName?: string;
    coachName?: string;
    coachEmail?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "請提供有效 JSON" }, { status: 400 });
  }

  const brandName = body.brandName?.trim() ?? "";
  const coachName = body.coachName?.trim() ?? "";
  const coachEmail = body.coachEmail?.trim().toLowerCase() ?? "";

  if (!brandName || !coachName || !coachEmail) {
    return NextResponse.json(
      { error: "請填寫品牌名稱、教練姓名與 Email" },
      { status: 400 }
    );
  }

  if (await emailExists(coachEmail)) {
    return NextResponse.json({ error: "該 Email 已經登記過" }, { status: 409 });
  }

  try {
    const { tenant, coachEmail: createdEmail } = await createPartnerTenantWithCoach({
      brandName,
      coachName,
      coachEmail,
      addedByAdminEmail: session.email,
    });

    return NextResponse.json({
      ok: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        gymName: tenant.gymName,
      },
      coachEmail: createdEmail,
    });
  } catch (error) {
    const readable = toReadableError(error, "建立合作品牌失敗");
    return NextResponse.json(
      {
        error: readable.message,
        hint: "請確認 Supabase 已執行 phase2-tenants.sql 或 fix-tenants-branding.sql",
      },
      { status: 500 }
    );
  }
}
