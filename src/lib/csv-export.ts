import { getMealAiComment } from "@/lib/ai-mock";
import type { MealLog, RegistryUser } from "@/lib/types";

export interface MealExportRow extends MealLog {
  studentName: string;
  aiComment: string;
}

export function buildMealExportRows(
  logs: MealLog[],
  students: RegistryUser[]
): MealExportRow[] {
  const nameByEmail = new Map(
    students.map((s) => [s.email.toLowerCase(), s.name])
  );

  return logs.map((log) => ({
    ...log,
    studentName: nameByEmail.get(log.email.toLowerCase()) ?? log.email,
    aiComment: getMealAiComment(log),
  }));
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function downloadMealsCsv(
  rows: MealExportRow[],
  fileName: string
): void {
  const headers = [
    "學員",
    "日期",
    "餐別",
    "食物描述",
    "卡路里",
    "蛋白質(g)",
    "碳水(g)",
    "脂肪(g)",
    "AI智能評語",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.studentName,
        new Date(row.date).toLocaleString("zh-HK"),
        row.mealType,
        row.description,
        row.calories,
        row.protein,
        row.carbs,
        row.fats,
        row.aiComment,
      ]
        .map(escapeCsvCell)
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
