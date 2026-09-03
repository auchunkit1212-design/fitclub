import { NextResponse } from "next/server";
import { fetchCommunityFeed } from "@/lib/community-db";
import { parseSessionFromRequest } from "@/lib/session-server";
import { toReadableError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    const posts = await fetchCommunityFeed({
      viewerEmail: session.email,
      tenantId: session.tenantId,
    });
    return NextResponse.json({ posts, source: "cloud" });
  } catch (error) {
    const readable = toReadableError(error, "讀取社群失敗");
    return NextResponse.json({ error: readable.message }, { status: 500 });
  }
}
