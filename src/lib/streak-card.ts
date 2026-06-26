import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { streakDateKey } from "@/lib/streak";

export type StreakCardInput = {
  days: number;
  studentName?: string;
  longestStreak?: number;
  isSpecialMilestone?: boolean;
};

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function renderStreakCardCanvas(input: StreakCardInput): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");

  const days = Math.max(1, Math.round(input.days));
  const name = input.studentName?.trim() || "學員";
  const longest = Math.max(days, Math.round(input.longestStreak ?? days));
  const dateLabel = streakDateKey();

  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#047857");
  bg.addColorStop(0.45, "#059669");
  bg.addColorStop(1, "#0f766e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, 72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144, 48);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = "bold 42px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(BRAND_NAME, CARD_WIDTH / 2, 180);

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(BRAND_TAGLINE, CARD_WIDTH / 2, 228);

  ctx.font = "bold 220px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(days), CARD_WIDTH / 2, 560);

  ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText("連續打卡天數", CARD_WIDTH / 2, 640);

  ctx.font = "600 44px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(name, CARD_WIDTH / 2, 760);

  const subline = input.isSpecialMilestone
    ? "里程碑達成！自律值得被看見"
    : longest > days
      ? `最長紀錄 ${longest} 天`
      : "今日打卡成功，繼續保持！";

  ctx.font = "500 34px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(subline, CARD_WIDTH / 2, 830);

  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText(dateLabel, CARD_WIDTH / 2, 1180);

  ctx.font = "600 30px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("🔥 Nutrition Coach", CARD_WIDTH / 2, 1240);

  return canvas;
}

export async function renderStreakCardBlob(input: StreakCardInput): Promise<Blob> {
  const canvas = renderStreakCardCanvas(input);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("CARD_EXPORT_FAILED"));
      },
      "image/png",
      1
    );
  });
}

export function downloadStreakCard(blob: Blob, days: number): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `nutrition-coach-streak-${days}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}
