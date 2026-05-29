import { NextRequest, NextResponse } from "next/server";
import { fetchUserByEmail } from "@/lib/db";
import { fetchTenantBySlug } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const email = request.nextUrl.searchParams.get("email");

  let logo: string | undefined;

  if (slug) {
    const tenant = await fetchTenantBySlug(slug);
    logo = tenant?.logoUrl;
  }

  if (!logo && email) {
    const user = await fetchUserByEmail(email);
    logo = user?.logo;
  }

  if (!logo) {
    const fallback = await fetch(
      new URL("/logo.png", request.nextUrl.origin).toString()
    );
    const bytes = await fallback.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (logo.startsWith("http")) {
    const remote = await fetch(logo);
    const bytes = await remote.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": remote.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const parsed = parseDataUrl(logo);
  if (parsed) {
    return new NextResponse(new Uint8Array(parsed.buffer), {
      headers: {
        "Content-Type": parsed.mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return NextResponse.redirect(new URL("/logo.png", request.nextUrl.origin));
}
