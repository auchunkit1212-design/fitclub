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
          fontSize: 88,
          fontWeight: 700,
        }}
      >
        食
      </div>
    ),
    { width: 192, height: 192 }
  );
}
