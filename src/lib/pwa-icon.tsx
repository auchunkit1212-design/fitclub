import { ImageResponse } from "next/og";

export function createFitClubIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
          borderRadius: size * 0.22,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: "white",
            fontWeight: 800,
          }}
        >
          <span style={{ fontSize: size * 0.28 }}>FC</span>
          <span style={{ fontSize: size * 0.1, marginTop: size * 0.02 }}>
            Gym
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
