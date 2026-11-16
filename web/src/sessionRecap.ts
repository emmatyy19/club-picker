import { compareClubs, type Shot, type Unit } from "./data";
import {
  dateMeasurements,
  eligibleDates,
  minimumDateShots,
  practiceContext,
  summarizeDates,
} from "./insights";
import type { BagMetric } from "./bagConsistency";

function windowFor(shots: Shot[], date: string, metric: BagMetric, unit: Unit) {
  const values = dateMeasurements(shots, metric, unit, "total");
  const day = values.get(date) ?? [];
  const prior = [...eligibleDates(values)].filter(([d]) => d < date).slice(-3);
  return {
    count: day.length,
    recent:
      day.length >= minimumDateShots
        ? summarizeDates(new Map([[date, day]]))
        : null,
    earlier: prior.length === 3 ? summarizeDates(new Map(prior)) : null,
    priorCount: prior.length,
  };
}

export function sessionRecap(shots: Shot[], date: string, unit: Unit) {
  const groups = new Map<string, Shot[]>();
  for (const shot of shots) {
    if (!shot.session_date || shot.session_date > date) continue;
    const key = JSON.stringify([
      shot.set_id,
      shot.club_id,
      practiceContext(shot),
    ]);
    const rows = groups.get(key) ?? [];
    rows.push(shot);
    groups.set(key, rows);
  }
  return [...groups]
    .flatMap(([key, rows]) => {
      const club = rows.find((s) => s.session_date === date);
      return club
        ? [
            {
              key,
              club,
              carry: windowFor(rows, date, "carry", unit),
              side: windowFor(rows, date, "side", unit),
            },
          ]
        : [];
    })
    .sort((a, b) => compareClubs(a.club, b.club) || a.key.localeCompare(b.key));
}
