import { readFile } from "node:fs/promises";
import path from "node:path";

const LOGO_PATH = path.join(process.cwd(), "public/gorilla-logo.png");

export async function readGorillaLogoBytes(): Promise<Buffer> {
  return readFile(LOGO_PATH);
}

export function gorillaLogoResponse(body: Buffer): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
