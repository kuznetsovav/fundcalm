import type { AssetSlice } from "@/lib/dca-types";

const COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"];

function describeArc(
  cx: number,
  cy: number,
  r: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const polar = (angle: number, radius: number) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polar(startAngle, r);
  const p2 = polar(endAngle, r);
  const p3 = polar(endAngle, rInner);
  const p4 = polar(startAngle, rInner);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export default function AllocationDonut({
  slices,
  size = 180,
}: {
  slices: AssetSlice[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const rInner = r * 0.62;

  let cursor = 0;
  const arcs = slices.map((slice, i) => {
    const start = cursor * 360;
    cursor += slice.weight;
    const end = cursor * 360;
    return {
      ticker: slice.ticker,
      d: describeArc(cx, cy, r, rInner, start, end),
      color: COLORS[i % COLORS.length],
      weight: slice.weight,
    };
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[180px] w-[180px]">
        {arcs.map((a) => (
          <path key={a.ticker} d={a.d} fill={a.color} />
        ))}
      </svg>
      <ul className="mt-4 w-full space-y-1.5">
        {arcs.map((a) => (
          <li
            key={a.ticker}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: a.color }}
                aria-hidden
              />
              <span className="font-semibold tabular-nums text-slate-800">
                {a.ticker}
              </span>
            </span>
            <span className="font-semibold tabular-nums text-slate-600">
              {Math.round(a.weight * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
