import {
  compareClubs,
  quantile,
  sessionKey,
  type Metric,
  type Shot,
  type Unit,
} from "./data";
import { trendContext, trendValue, type TrendMetric } from "./trends";
export type RankingMetric = Exclude<TrendMetric, "spread">;
export type RankingStat =
  "range" | "relative" | "median_high" | "median_low" | "miss";
export type ClubRanking = {
  key: string;
  club: Shot;
  n: number;
  sessions: number;
  undated: number;
  low: number;
  high: number;
  median: number;
  score: number;
  rank: number;
};
/** Compare observed club/context distributions, never predicted reliability. */
export function rankClubs(
  shots: Shot[],
  options: {
    metric: RankingMetric;
    lateral: Metric;
    unit: Unit;
    statistic: RankingStat;
    minShots: number;
  },
): { rows: ClubRanking[]; insufficient: number; unavailable: number } {
  const { metric, lateral, unit, statistic, minShots } = options;
  if (!Number.isInteger(minShots) || minShots < 1)
    throw Error("Minimum shots must be a positive integer.");
  if (statistic === "relative" && metric !== "carry" && metric !== "total")
    throw Error("Relative spread requires a distance metric.");
  if (statistic === "miss" && metric !== "side")
    throw Error("Typical miss requires left/right measurements.");
  const bins = new Map<string, { shot: Shot; value: number | null }[]>();
  for (const shot of shots) {
    if (shot.quality !== "usable") continue;
    const key = trendContext(shot, metric, lateral);
    const bin = bins.get(key) ?? [];
    bin.push({ shot, value: trendValue(shot, metric, unit, lateral) });
    bins.set(key, bin);
  }
  const rows: ClubRanking[] = [];
  let insufficient = 0,
    unavailable = 0;
  for (const [key, bin] of bins) {
    const measured = bin.filter(
      (p): p is { shot: Shot; value: number } => p.value !== null,
    );
    if (!measured.length) {
      unavailable++;
      continue;
    }
    const minimum = ["range", "relative"].includes(statistic)
      ? Math.max(2, minShots)
      : minShots;
    if (measured.length < minimum) {
      insufficient++;
      continue;
    }
    const values = measured.map((p) => p.value);
    const low = quantile(values, 0.1)!,
      high = quantile(values, 0.9)!,
      median = quantile(values, 0.5)!;
    if (statistic === "relative" && median <= 0) {
      unavailable++;
      continue;
    }
    const score =
      statistic === "range"
        ? high - low
        : statistic === "relative"
          ? (100 * (high - low)) / median
          : statistic === "miss"
            ? quantile(values.map(Math.abs), 0.5)!
            : median;
    rows.push({
      key,
      club: bin[0].shot,
      n: values.length,
      sessions: new Set(
        measured
          .filter((p) => p.shot.session_date !== null)
          .map((p) => sessionKey(p.shot)),
      ).size,
      undated: measured.filter((p) => p.shot.session_date === null).length,
      low,
      high,
      median,
      score,
      rank: 0,
    });
  }
  const direction = statistic === "median_high" ? -1 : 1;
  rows.sort(
    (a, b) =>
      direction * (a.score - b.score) ||
      compareClubs(a.club, b.club) ||
      a.key.localeCompare(b.key),
  );
  for (let i = 0; i < rows.length; i++) {
    rows[i].rank =
      i > 0 &&
      Math.abs(rows[i].score - rows[i - 1].score) <=
        1e-9 * Math.max(1, Math.abs(rows[i].score))
        ? rows[i - 1].rank
        : i + 1;
  }
  return { rows, insufficient, unavailable };
}
