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

const EXPORT_HEADERS = [
  "學員",
  "日期",
  "餐別",
  "食物描述",
  "卡路里",
  "蛋白質(g)",
  "碳水(g)",
  "脂肪(g)",
  "AI智能評語",
] as const;

function formatExportDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function rowToCells(row: MealExportRow): (string | number)[] {
  return [
    row.studentName,
    formatExportDate(row.date),
    row.mealType,
    row.description,
    row.calories,
    row.protein,
    row.carbs,
    row.fats,
    row.aiComment,
  ];
}

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** UTF-8 CSV（Excel 可開，備用） */
export function downloadMealsCsv(
  rows: MealExportRow[],
  fileName: string
): void {
  const lines = [
    EXPORT_HEADERS.join(","),
    ...rows.map((row) => rowToCells(row).map(escapeCsvCell).join(",")),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, fileName.endsWith(".csv") ? fileName : `${fileName}.csv`);
}

/**
 * Excel 相容匯出（HTML Spreadsheet）
 * 雙擊可直接用 Microsoft Excel / Numbers 開啟，中文唔會亂碼。
 */
export function downloadMealsExcel(
  rows: MealExportRow[],
  fileName: string
): void {
  const headerRow = EXPORT_HEADERS.map(
    (h) => `<th>${escapeHtml(h)}</th>`
  ).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = rowToCells(row)
        .map((cell) => `<td>${escapeHtml(cell)}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>MealLogs</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>td,th{border:1px solid #ccc;padding:4px 8px;white-space:pre-wrap;}</style>
</head>
<body>
<table>
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`;

  const blob = new Blob(["\uFEFF" + html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const base = fileName.replace(/\.(csv|xls|xlsx)$/i, "");
  triggerDownload(blob, `${base}.xls`);
}
