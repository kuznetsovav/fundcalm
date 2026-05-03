"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import type { QuoteHistoryPoint } from "@/lib/dca-quotes";

export default function Sparkline({
  data,
  positive,
  height = 48,
}: {
  data: QuoteHistoryPoint[];
  positive: boolean;
  height?: number;
}) {
  if (data.length < 2) {
    return <div style={{ height }} aria-hidden />;
  }
  const color = positive ? "#10b981" : "#ef4444";
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
