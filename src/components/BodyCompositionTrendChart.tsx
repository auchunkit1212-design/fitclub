"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/components/I18nProvider";
import type { BodyCompositionLog } from "@/lib/types";

function formatChartLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${Number(month)}/${Number(day)}`;
}

interface BodyCompositionTrendChartProps {
  logs: BodyCompositionLog[];
  loading?: boolean;
}

export function BodyCompositionTrendChart({
  logs,
  loading,
}: BodyCompositionTrendChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(
    () =>
      logs.map((log) => ({
        label: formatChartLabel(log.logDate),
        fullDate: log.logDate,
        bodyFat: log.bodyFatPct,
        muscle: log.muscleMassKg ?? log.skeletalMuscleKg,
      })),
    [logs]
  );

  const hasFat = logs.some((l) => l.bodyFatPct != null);
  const hasMuscle = logs.some(
    (l) => l.muscleMassKg != null || l.skeletalMuscleKg != null
  );

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-zinc-400">
        {t("inbody.loading", "載入身體組成數據中...")}
      </div>
    );
  }

  if (logs.length === 0 || (!hasFat && !hasMuscle)) {
    return (
      <div className="h-36 flex flex-col items-center justify-center text-center px-4">
        <p className="text-sm text-zinc-500">
          {t("inbody.emptyTitle", "尚未有 InBody 進度")}
        </p>
        <p className="text-xs text-zinc-400 mt-1">
          {t(
            "inbody.emptyHint",
            "影張報告上傳後，體脂同肌肉趨勢會顯示喺呢度"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full overflow-hidden">
      <div className="h-44 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              formatter={(value, name) => {
                const label =
                  name === "bodyFat"
                    ? t("inbody.metric.bodyFat", "體脂率")
                    : t("inbody.metric.muscle", "肌肉量");
                const unit = name === "bodyFat" ? "%" : " kg";
                return [`${value ?? "—"}${unit}`, label];
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as
                  | { fullDate?: string }
                  | undefined;
                return row?.fullDate ?? "";
              }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e4e4e7",
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) =>
                value === "bodyFat"
                  ? t("inbody.metric.bodyFat", "體脂率")
                  : t("inbody.metric.muscle", "肌肉量")
              }
            />
            {hasFat && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="bodyFat"
                name="bodyFat"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                connectNulls={false}
              />
            )}
            {hasMuscle && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="muscle"
                name="muscle"
                stroke="#0ea5e9"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 0 }}
                connectNulls={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
