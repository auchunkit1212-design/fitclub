import { createFitClubIcon } from "@/lib/pwa-icon";

export const runtime = "edge";

export async function GET() {
  return createFitClubIcon(512);
}
