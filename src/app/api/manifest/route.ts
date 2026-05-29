import { NextRequest, NextResponse } from "next/server";
import { resolveBrandForUser } from "@/lib/branding";
import { fetchUsersForSession } from "@/lib/db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { DEFAULT_BRANDING } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = parseSessionFromRequest(request);
  const origin = request.nextUrl.origin;

  let name = DEFAULT_BRANDING.appTitle;
  let themeColor = "#059669";
  let iconUrl = `${origin}/logo.png`;

  if (session?.isLoggedIn) {
    try {
      const registry = await fetchUsersForSession(session);
      const brand = await resolveBrandForUser(session, registry);
      name = brand.gymName || brand.branding.appTitle;
      themeColor =
        brand.branding.themeColor === "blue"
          ? "#2563eb"
          : brand.branding.themeColor === "black"
            ? "#18181b"
            : "#059669";

      if (session.tenantSlug) {
        iconUrl = `${origin}/api/tenant/logo?slug=${encodeURIComponent(session.tenantSlug)}`;
      } else if (brand.branding.logo?.startsWith("http")) {
        iconUrl = brand.branding.logo;
      } else if (brand.branding.logo?.startsWith("data:")) {
        iconUrl = `${origin}/api/tenant/logo?email=${encodeURIComponent(session.email)}`;
      }
    } catch {
      name = session.brandName ?? session.gym ?? name;
      if (session.tenantSlug) {
        iconUrl = `${origin}/api/tenant/logo?slug=${encodeURIComponent(session.tenantSlug)}`;
      }
    }
  }

  const manifest = {
    name: `${name} 健康管理`,
    short_name: name.slice(0, 12),
    description: `${name} 專屬飲食打卡同教練管理`,
    start_url: "/register",
    scope: "/",
    id: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "zh-HK",
    background_color: "#ffffff",
    theme_color: themeColor,
    icons: [
      {
        src: iconUrl,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: iconUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: iconUrl,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store",
    },
  });
}
