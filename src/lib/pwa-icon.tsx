import { ImageResponse } from "next/og";
import { BRAND_NAME } from "@/lib/brand";

export function createNutritionCoachIcon(size: number) {
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
            textAlign: "center",
            padding: size * 0.08,
          }}
        >
          <span style={{ fontSize: size * 0.22 }}>NC</span>
          <span style={{ fontSize: size * 0.07, marginTop: size * 0.02 }}>
            Coach
          </span>
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}

/** @deprecated */
export const createFitClubIcon = createNutritionCoachIcon;
