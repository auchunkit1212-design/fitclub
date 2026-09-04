"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeightLog } from "@/lib/types";

function formatChartLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

interface WeightTrendChartProps {
  logs: WeightLog[];
  loading?: boolean;
  compact?: boolean;
}

export function WeightTrendChart({
  logs,
  loading,
  compact = false,
}: WeightTrendChartProps) {
  const chartData = useMemo(
    () =>
      logs.map((log) => ({
        label: formatChartLabel(log.logDate),
        weight: log.weightKg,
        fullDate: log.logDate,
      })),
    [logs]
  );

  const latest = logs.length > 0 ? logs[logs.length - 1].weightKg : null;

  const yDomain = useMemo(() => {
    if (logs.length === 0) return [0, 100];
    const weights = logs.map((l) => l.weightKg);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const pad = logs.length === 1 ? 2 : Math.max(0.5, (max - min) * 0.15 || 1);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [logs]);

  if (loading) {
    return (
      <div
        className={`${compact ? "h-16" : "h-36"} flex items-center justify-center text-sm text-zinc-400`}
      >
        載入體重數據中...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div
        className={`${compact ? "h-16" : "h-36"} flex flex-col items-center justify-center text-center px-4`}
      >
        <p className="text-sm text-zinc-500">尚無足夠數據</p>
        {!compact && (
          <p className="text-xs text-zinc-400 mt-1">
            記錄今日體重後，過去 7 日趨勢會顯示喺呢度
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full overflow-hidden">
      <div className={`${compact ? "h-16" : "h-36"} w-full min-w-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={
              compact
                ? { top: 4, right: 4, left: 4, bottom: 0 }
                : { top: 8, right: 8, left: -16, bottom: 0 }
            }
          >
            {!compact && <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />}
            <XAxis
              dataKey="label"
              tick={compact ? false : { fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              hide={compact}
            />
            <YAxis
              domain={yDomain}
              tick={compact ? false : { fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={compact ? 0 : 36}
              hide={compact}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              formatter={(value) => [`${value ?? ""} kg`, "體重"]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as { fullDate?: string } | undefined;
                return row?.fullDate ?? "";
              }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke={compact ? "#8b7cf6" : "#10b981"}
              strokeWidth={logs.length === 1 ? 0 : compact ? 2 : 2.5}
              dot={{
                r: compact ? 2.5 : logs.length === 1 ? 5 : 4,
                fill: compact ? "#8b7cf6" : "#10b981",
                strokeWidth: 0,
              }}
              activeDot={{ r: compact ? 4 : 6 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {latest != null && !compact && (
        <p className="text-xs text-zinc-500 mt-2 text-center">
          最新: {latest} kg
          {logs.length === 1 ? "（僅 1 筆記錄，多記幾日就會顯示趨勢線）" : ""}
        </p>
      )}
    </div>
  );
}
