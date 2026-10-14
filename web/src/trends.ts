import {
  distance,
  groupKey,
  quantile,
  sessionKey,
  side,
  type Metric,
  type Shot,
  type Unit,
} from "./data";
export const trendMetrics = [
  { value: "carry", label: "Carry" },
  { value: "total", label: "Total" },
  { value: "ball_speed", label: "Ball speed" },
  { value: "side", label: "Left / right" },
  { value: "spread", label: "Sideways spread" },
  { value: "spin", label: "Spin rate" },
  { value: "launch", label: "Launch angle" },
  { value: "height", label: "Height" },
  { value: "landing", label: "Landing angle" },
  { value: "hang_time", label: "Hang time" },
  { value: "curve", label: "Curve" },
] as const;
export type TrendMetric = (typeof trendMetrics)[number]["value"];
export function trendUnit(metric: TrendMetric, unit: Unit): string {
  if (metric === "ball_speed") return unit === "yd" ? "mph" : "m/s";
  if (metric === "spin") return "rpm";
  if (["launch", "landing"].includes(metric)) return "°";
  if (metric === "hang_time") return "s";
  return unit;
}
export function trendValue(
  shot: Shot,
  metric: TrendMetric,
  unit: Unit,
  lateral: Metric,
): number | null {
  const divisor = unit === "yd" ? 0.9144 : 1;
  if (metric === "carry" || metric === "total")
    return distance(shot, metric, unit);
  if (metric === "side" || metric === "spread")
    return side(shot, lateral, unit);
  if (metric === "ball_speed")
    return shot.ball_speed_mps == null
      ? null
      : shot.ball_speed_mps / (unit === "yd" ? 0.44704 : 1);
  if (metric === "spin") return shot.spin_rpm ?? null;
  if (metric === "launch") return shot.launch_deg ?? null;
  if (metric === "height")
    return shot.apex_m == null ? null : shot.apex_m / divisor;
  if (metric === "landing") return shot.landing_deg ?? null;
  if (metric === "hang_time") return shot.hang_time_s ?? null;
  return shot.curve_m == null ? null : shot.curve_m / divisor;
}
export function trendContext(
  shot: Shot,
  metric: TrendMetric,
  lateral: Metric,
): string {
  // Preserve both distance bases for supplemental measurements in separate mode.
  return metric === "carry" || metric === "total"
    ? groupKey(shot, metric)
    : metric === "side" || metric === "spread"
      ? groupKey(shot, lateral)
      : JSON.stringify([groupKey(shot, "carry"), shot.total_basis]);
}
export type SessionTrend = {
  date: string;
  session: string;
  context: string;
  n: number;
  median: number;
  low: number | null;
  high: number | null;
  shots: { shot: Shot; value: number }[];
};
export function sessionTrends(
  shots: Shot[],
  metric: TrendMetric,
  unit: Unit,
  lateral: Metric,
  mode: "separate" | "combined" = "separate",
): SessionTrend[] {
  const bins = new Map<string, { shot: Shot; value: number }[]>();
  for (const shot of shots) {
    if (shot.quality !== "usable" || shot.session_date === null) continue;
    const value = trendValue(shot, metric, unit, lateral);
    if (value === null) continue;
    const key =
      mode === "combined"
        ? JSON.stringify(["combined", shot.session_date])
        : JSON.stringify([
            trendContext(shot, metric, lateral),
            sessionKey(shot),
          ]);
    const bin = bins.get(key) ?? [];
    bin.push({ shot, value });
    bins.set(key, bin);
  }
  return [...bins.values()]
    .flatMap((bin): SessionTrend[] => {
      if (metric === "spread" && bin.length < 2) return [];
      const values = bin.map((p) => p.value),
        low = quantile(values, 0.1)!,
        high = quantile(values, 0.9)!;
      return [
        {
          date: bin[0].shot.session_date!,
          session:
            mode === "combined"
              ? JSON.stringify(["combined", bin[0].shot.session_date])
              : JSON.stringify([
                  trendContext(bin[0].shot, metric, lateral),
                  sessionKey(bin[0].shot),
                ]),
          context:
            mode === "combined"
              ? "combined"
              : trendContext(bin[0].shot, metric, lateral),
          n: bin.length,
          median: metric === "spread" ? high - low : quantile(values, 0.5)!,
          low: metric === "spread" ? null : low,
          high: metric === "spread" ? null : high,
          shots: bin,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.context.localeCompare(b.context) ||
        a.session.localeCompare(b.session),
    );
}
