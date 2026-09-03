import { NextResponse } from "next/server";
import {
  InBodyScanError,
  isInBodyScanEmpty,
  scanInBodyReport,
} from "@/lib/inbody-scan";
import { parseSessionFromRequest } from "@/lib/session-server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = parseSessionFromRequest(request);
  if (!session?.email) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as { imageBase64?: string; image?: string };
  const imageBase64 = (body.imageBase64 ?? body.image ?? "").trim();
  if (!imageBase64) {
    return NextResponse.json({ error: "請上傳 InBody 報告相片" }, { status: 400 });
  }

  try {
    const result = await scanInBodyReport(imageBase64);
    if (isInBodyScanEmpty(result)) {
      return NextResponse.json(
        {
          error:
            "報告有點模糊，大猩猩睇唔清！請影清楚成張 InBody／體脂報告，或者手動輸入。",
          blur: true,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InBodyScanError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inbody-scan]", error);
    return NextResponse.json({ error: "InBody 辨識失敗" }, { status: 500 });
  }
}
