import { compareClubs, type Shot, type Unit } from "./data";
import {
  dateMeasurements,
  eligibleDates,
  practiceContext,
  summarizeDates,
} from "./insights";

export type BagMetric = "carry" | "side";

export function bagConsistency(
  shots: Shot[],
  set: string,
  metric: BagMetric,
  unit: Unit,
  widest: boolean,
) {
  const groups = new Map<string, Shot[]>();
  for (const shot of shots) {
    if (shot.set_id !== set) continue;
    const key = JSON.stringify([shot.club_id, practiceContext(shot)]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(shot);
  }
  const result = [...groups].map(([key, rows]) => {
    const values = dateMeasurements(rows, metric, unit, "total");
    const eligible = [...eligibleDates(values)];
    // Still show recorded measurements when every date is sparse.
    const window = eligible.length
      ? eligible
      : [...values].sort(([a], [b]) => a.localeCompare(b));
    const recent = window.length
      ? summarizeDates(new Map(window.slice(-3)))
      : null;
    const earlier =
      eligible.length >= 6
        ? summarizeDates(new Map(eligible.slice(-6, -3)))
        : null;
    return {
      key,
      club: rows[0],
      rows,
      recent,
      earlier,
      limited: eligible.length === 0,
      change: recent && earlier ? recent.spread - earlier.spread : null,
    };
  });
  return result.sort(
    (a, b) =>
      (widest ? (b.recent?.spread ?? -1) - (a.recent?.spread ?? -1) : 0) ||
      compareClubs(a.club, b.club) ||
      a.key.localeCompare(b.key),
  );
}
