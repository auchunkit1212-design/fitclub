import { NextRequest, NextResponse } from "next/server";
import { isCustomBrandLogo, normalizeThemeColor } from "@/lib/brand";
import { tenantLogoProxyUrl } from "@/lib/brand-logo";
import { fetchTenantByInviteCode } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "缺少邀請碼" }, { status: 400 });
  }

  try {
    const tenant = await fetchTenantByInviteCode(slug);
    if (!tenant) {
      return NextResponse.json({ error: "找不到健身室" }, { status: 404 });
    }

    const hasLogo = Boolean(
      tenant.logoUrl &&
        (isCustomBrandLogo(tenant.logoUrl) || tenant.logoUrl.startsWith("data:"))
    );

    return NextResponse.json({
      gymName: tenant.gymName,
      slug: tenant.slug,
      logo: hasLogo ? tenantLogoProxyUrl({ slug: tenant.slug }) : undefined,
      themeColor: normalizeThemeColor(tenant.themeColor),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查詢失敗";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
