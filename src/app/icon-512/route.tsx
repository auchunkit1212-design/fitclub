import { gorillaLogoResponse, readGorillaLogoBytes } from "@/lib/gorilla-logo";

export const runtime = "nodejs";

export async function GET() {
  const body = await readGorillaLogoBytes();
  return gorillaLogoResponse(body);
}
