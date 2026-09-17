import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { streakDateKey } from "@/lib/streak";
import {
  getStreakCardTemplate,
  normalizeStreakCardTemplate,
  type StreakCardTemplateId,
} from "@/lib/streak-templates";

export type StreakCardInput = {
  days: number;
  studentName?: string;
  longestStreak?: number;
  isSpecialMilestone?: boolean;
  templateId?: StreakCardTemplateId;
};

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;

type PaintContext = {
  ctx: CanvasRenderingContext2D;
  days: number;
  name: string;
  longest: number;
  dateLabel: string;
  subline: string;
  isSpecial: boolean;
};

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

function paintSharedContent(
  ctx: CanvasRenderingContext2D,
  paint: PaintContext,
  colors: {
    title: string;
    subtitle: string;
    number: string;
    label: string;
    name: string;
    meta: string;
    footer: string;
  }
) {
  const cx = CARD_WIDTH / 2;

  ctx.textAlign = "center";
  ctx.fillStyle = colors.title;
  ctx.font = "bold 42px system-ui, -apple-system, sans-serif";
  ctx.fillText(BRAND_NAME, cx, 180);

  ctx.fillStyle = colors.subtitle;
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText(BRAND_TAGLINE, cx, 228);

  ctx.font = "bold 220px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.number;
  ctx.fillText(String(paint.days), cx, 560);

  ctx.font = "bold 56px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.label;
  ctx.fillText("連續打卡天數", cx, 640);

  ctx.font = "600 44px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.name;
  ctx.fillText(paint.name, cx, 760);

  ctx.font = "500 34px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.meta;
  ctx.fillText(paint.subline, cx, 830);

  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.footer;
  ctx.fillText(paint.dateLabel, cx, 1180);

  ctx.font = "600 30px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.footer;
  ctx.fillText(
    paint.isSpecial ? "🏆 里程碑達成" : "🔥 Nutrition Coach",
    cx,
    1240
  );
}

function paintEmerald(ctx: CanvasRenderingContext2D, paint: PaintContext) {
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#047857");
  bg.addColorStop(0.45, "#059669");
  bg.addColorStop(1, "#0f766e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, 72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144, 48);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 3;
  roundRect(ctx, 72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144, 48);
  ctx.stroke();

  paintSharedContent(ctx, paint, {
    title: "rgba(255,255,255,0.92)",
    subtitle: "rgba(255,255,255,0.75)",
    number: "#ffffff",
    label: "rgba(255,255,255,0.95)",
    name: "rgba(255,255,255,0.9)",
    meta: "rgba(255,255,255,0.82)",
    footer: "rgba(255,255,255,0.65)",
  });
}

function paintSunset(ctx: CanvasRenderingContext2D, paint: PaintContext) {
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#c2410c");
  bg.addColorStop(0.4, "#f97316");
  bg.addColorStop(1, "#dc2626");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(180, 260, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(900, 320, 180, 0, Math.PI * 2);
  ctx.fill();

  roundRect(ctx, 64, 64, CARD_WIDTH - 128, CARD_HEIGHT - 128, 56);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 4;
  ctx.stroke();

  paintSharedContent(ctx, paint, {
    title: "rgba(255,255,255,0.95)",
    subtitle: "rgba(255,255,255,0.8)",
    number: "#fff7ed",
    label: "#ffffff",
    name: "rgba(255,255,255,0.95)",
    meta: "rgba(255,255,255,0.88)",
    footer: "rgba(255,255,255,0.7)",
  });
}

function paintMidnight(ctx: CanvasRenderingContext2D, paint: PaintContext) {
  const bg = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.55, "#1e293b");
  bg.addColorStop(1, "#020617");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "rgba(251,191,36,0.08)";
  for (let i = 0; i < 24; i++) {
    const x = 80 + (i * 41) % (CARD_WIDTH - 160);
    const y = 100 + ((i * 97) % 420);
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  roundRect(ctx, 56, 56, CARD_WIDTH - 112, CARD_HEIGHT - 112, 52);
  ctx.strokeStyle = "rgba(251,191,36,0.45)";
  ctx.lineWidth = 5;
  ctx.stroke();

  paintSharedContent(ctx, paint, {
    title: "#fde68a",
    subtitle: "rgba(253,230,138,0.75)",
    number: "#fbbf24",
    label: "#fef3c7",
    name: "#fffbeb",
    meta: "rgba(254,243,199,0.85)",
    footer: "rgba(253,230,138,0.6)",
  });
}

function paintOcean(ctx: CanvasRenderingContext2D, paint: PaintContext) {
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
  bg.addColorStop(0, "#0369a1");
  bg.addColorStop(0.5, "#0ea5e9");
  bg.addColorStop(1, "#0d9488");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(
      CARD_WIDTH * (0.2 + i * 0.22),
      980 + i * 18,
      220,
      36,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  roundRect(ctx, 72, 72, CARD_WIDTH - 144, CARD_HEIGHT - 144, 48);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();

  paintSharedContent(ctx, paint, {
    title: "rgba(255,255,255,0.95)",
    subtitle: "rgba(224,242,254,0.85)",
    number: "#ffffff",
    label: "#e0f2fe",
    name: "#ffffff",
    meta: "rgba(224,242,254,0.9)",
    footer: "rgba(224,242,254,0.7)",
  });
}

function paintMinimal(ctx: CanvasRenderingContext2D, paint: PaintContext) {
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  roundRect(ctx, 48, 48, CARD_WIDTH - 96, CARD_HEIGHT - 96, 40);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4;
  ctx.stroke();

  const accent = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  accent.addColorStop(0, "#059669");
  accent.addColorStop(1, "#0d9488");
  roundRect(ctx, 48, 48, CARD_WIDTH - 96, 12, 40);
  ctx.fillStyle = accent;
  ctx.fill();

  paintSharedContent(ctx, paint, {
    title: "#0f172a",
    subtitle: "#64748b",
    number: "#059669",
    label: "#334155",
    name: "#0f172a",
    meta: "#475569",
    footer: "#94a3b8",
  });
}

const TEMPLATE_PAINTERS: Record<
  StreakCardTemplateId,
  (ctx: CanvasRenderingContext2D, paint: PaintContext) => void
> = {
  emerald: paintEmerald,
  sunset: paintSunset,
  midnight: paintMidnight,
  ocean: paintOcean,
  minimal: paintMinimal,
};

export function renderStreakCardCanvas(input: StreakCardInput): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("CANVAS_UNAVAILABLE");

  const days = Math.max(1, Math.round(input.days));
  const name = input.studentName?.trim() || "學員";
  const longest = Math.max(days, Math.round(input.longestStreak ?? days));
  const templateId = normalizeStreakCardTemplate(
    input.templateId ?? getStreakCardTemplate()
  );

  const subline = input.isSpecialMilestone
    ? "里程碑達成！自律值得被看見"
    : longest > days
      ? `最長紀錄 ${longest} 天`
      : "今日打卡成功，繼續保持！";

  const paint: PaintContext = {
    ctx,
    days,
    name,
    longest,
    dateLabel: streakDateKey(),
    subline,
    isSpecial: Boolean(input.isSpecialMilestone),
  };

  TEMPLATE_PAINTERS[templateId](ctx, paint);

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
