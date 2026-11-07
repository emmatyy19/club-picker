import {
  clubOrder,
  compareClubs,
  type Metric,
  type Shot,
  type Unit,
} from "./data";
import { trendValue, type TrendMetric } from "./trends";

export const minimumDateShots = 5;
export type DateValues = Map<string, number[]>;
export type Distribution = {
  low: number;
  median: number;
  high: number;
  spread: number;
  shots: number;
  dates: string[];
};

/** Empirical quantiles with equal weight per practice date, including mishits. */
export function summarizeDates(values: DateValues): Distribution {
  if (
    !values.size ||
    [...values.values()].some(
      (v) => !v.length || v.some((x) => !Number.isFinite(x)),
    )
  )
    throw Error("Need nonempty, finite measurements for every date.");
  const points = [...values.values()]
    .flatMap((v) => v.map((x) => ({ x, w: 1 / values.size / v.length })))
    .sort((a, b) => a.x - b.x);
  const q = (p: number) => {
    let mass = 0;
    for (let i = 0; i < points.length; i++) {
      mass += points[i].w;
      if (Math.abs(mass - p) <= 1e-10)
        return (points[i].x + (points[i + 1]?.x ?? points[i].x)) / 2;
      if (mass > p) return points[i].x;
    }
    return points.at(-1)!.x;
  };
  const low = q(0.1),
    median = q(0.5),
    high = q(0.9);
  return {
    low,
    median,
    high,
    spread: high - low,
    shots: points.length,
    dates: [...values.keys()].sort(),
  };
}

/** Keep both distance bases and all recorded measurement settings distinct. */
export function practiceContext(s: Shot): string {
  return JSON.stringify([
    s.source,
    s.intent,
    s.normalization,
    s.compensation,
    s.carry_basis,
    s.total_basis,
    s.session_mode,
    s.normalization_settings,
    s.ball_type,
    s.surface,
  ]);
}

export function dateMeasurements(
  shots: Shot[],
  metric: TrendMetric,
  unit: Unit,
  lateral: Metric,
): DateValues {
  const result: DateValues = new Map();
  for (const shot of shots) {
    const v = trendValue(shot, metric, unit, lateral);
    if (shot.quality !== "usable" || !shot.session_date || v === null) continue;
    const values = result.get(shot.session_date) ?? [];
    values.push(v);
    result.set(shot.session_date, values);
  }
  return result;
}

export function eligibleDates(values: DateValues): DateValues {
  return new Map(
    [...values]
      .filter(([, v]) => v.length >= minimumDateShots)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function compareDates(values: DateValues) {
  const eligible = eligibleDates(values);
  const dates = [...eligible.keys()].slice(-6);
  const summarize = (days: string[]) =>
    summarizeDates(new Map(days.map((d) => [d, eligible.get(d)!])));
  return {
    eligible: eligible.size,
    earlier: dates.length === 6 ? summarize(dates.slice(0, 3)) : null,
    recent: dates.length === 6 ? summarize(dates.slice(3)) : null,
  };
}

export function comparisonGroups(
  shots: Shot[],
  metric: TrendMetric,
  unit: Unit,
  lateral: Metric,
  combined: boolean,
) {
  const groups = new Map<string, Shot[]>();
  for (const s of shots) {
    const key = combined
      ? "combined"
      : JSON.stringify([s.club_id, practiceContext(s)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups].map(([key, rows]) => {
    const measurements = dateMeasurements(rows, metric, unit, lateral);
    return {
      key,
      shot: rows[0],
      measuredDates: measurements.size,
      ...compareDates(measurements),
    };
  });
}

export function distanceGroups(shots: Shot[], metric: Metric, unit: Unit) {
  const groups = new Map<string, Shot[]>();
  for (const s of shots) {
    const key = JSON.stringify([s.set_id, practiceContext(s)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      const clubs = [
        ...new Map(
          rows
            .slice()
            .sort(compareClubs)
            .map((s) => [s.club_id, s]),
        ).values(),
      ];
      const bands = clubs.map((s) => {
        const values = eligibleDates(
          dateMeasurements(
            rows.filter((r) => r.club_id === s.club_id),
            metric,
            unit,
            metric,
          ),
        );
        return {
          shot: s,
          values,
          summary: values.size ? summarizeDates(values) : null,
        };
      });
      const bandsWithGaps = bands.map((band, i) => {
        const next = bands[i + 1];
        const dates = next
          ? [...band.values.keys()].filter((d) => next.values.has(d))
          : [];
        const ordered =
          next &&
          clubOrder(band.shot.club_label) < clubOrder(next.shot.club_label) &&
          clubOrder(next.shot.club_label) < 200;
        const paired =
          ordered && dates.length
            ? {
                first: summarizeDates(
                  new Map(dates.map((d) => [d, band.values.get(d)!])),
                ),
                second: summarizeDates(
                  new Map(dates.map((d) => [d, next.values.get(d)!])),
                ),
              }
            : null;
        const gap = paired ? paired.first.median - paired.second.median : null;
        return {
          ...band,
          gap,
          paired,
          sharedDates: dates.length,
          next: next?.shot.club_label,
        };
      });
      return { key, shot: rows[0], bands: bandsWithGaps };
    });
}

/** Compare only dates already eligible for each physical club. */
export function sharedClubDates(first: DateValues, second: DateValues) {
  const eligibleSecond = eligibleDates(second);
  return [...eligibleDates(first)]
    .flatMap(([date, values]) => {
      const other = eligibleSecond.get(date);
      if (!other) return [];
      const a = summarizeDates(new Map([[date, values]]));
      const b = summarizeDates(new Map([[date, other]]));
      return [{ date, a, b, gap: a.median - b.median }];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
