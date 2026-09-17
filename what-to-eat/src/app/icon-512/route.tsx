import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1b4332",
          color: "#d8f3dc",
          fontSize: 220,
          fontWeight: 700,
        }}
      >
        食
      </div>
    ),
    { width: 512, height: 512 }
  );
}
