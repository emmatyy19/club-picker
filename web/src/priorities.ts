import { type Shot } from "./data";
import { practiceContext, summarizeDates } from "./insights";
export type Priority = {
  key: string;
  club: string;
  set: string;
  source: string;
  title: string;
  kind: string;
  hits: number;
  threshold: number;
  dates: { date: string; value: number; n: number }[];
  unknownIntent: boolean;
  contextShot: Shot;
};
/** Provisional descriptive screens; not fitted models or scoring estimates. */
export function practicePriorities(shots: Shot[]) {
  const groups = new Map<string, Shot[]>();
  for (const s of shots) {
    if (s.quality !== "usable" || !s.session_date) continue;
    const key = JSON.stringify([s.club_id, practiceContext(s)]);
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const results: Priority[] = [];
  let supported = 0;
  for (const [key, rows] of groups) {
    const byDate = new Map<string, Shot[]>();
    for (const s of rows)
      byDate.set(s.session_date!, [...(byDate.get(s.session_date!) ?? []), s]);
    const dates = [...byDate]
      .filter(([, v]) => v.length >= 10)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-3);
    if (dates.length < 3) continue;
    supported++;
    const carry = dates.map(([date, rs]) => {
      const v = rs.map((s) => s.carry_m);
      const d = summarizeDates(new Map([[date, v]]));
      return {
        date,
        n: rs.length,
        median: d.median,
        width: d.median > 0 ? d.spread / d.median : null,
        short:
          d.median > 0
            ? v.filter((x) => x < 0.8 * d.median).length / v.length
            : null,
      };
    });
    const candidates: Pick<
      Priority,
      "kind" | "title" | "threshold" | "dates"
    >[] = carry.every((d) => d.median > 0)
      ? [
          {
            kind: "width",
            title: "Carry varies widely",
            threshold: 0.3,
            dates: carry.map((d) => ({ ...d, value: d.width! })),
          },
          {
            kind: "short",
            title: "Frequent short shots",
            threshold: 0.2,
            dates: carry.map((d) => ({ ...d, value: d.short! })),
          },
        ]
      : [];
    // Use finishing side consistently; never mix landing and finishing offsets.
    for (const sign of [-1, 1]) {
      const side = dates.map(([date, rs]) => {
        const vs = rs.flatMap((s) =>
          s.total_side_m === null ? [] : [s.total_side_m],
        );
        return {
          date,
          n: vs.length,
          value: vs.length
            ? vs.filter((v) => sign * v > 4.572).length / vs.length
            : 0,
        };
      });
      if (side.every((d) => d.n >= 10))
        candidates.push({
          kind: sign < 0 ? "left" : "right",
          title: `Finishing misses lean ${sign < 0 ? "left" : "right"}`,
          threshold: 0.6,
          dates: side,
        });
    }
    for (const c of candidates) {
      const hits = c.dates.filter((d) => d.value >= c.threshold).length;

      results.push({
        ...c,
        key: `${key}:${c.kind}`,
        club: rows[0].club_label,
        set: rows[0].set_id,
        source: rows[0].source,
        hits,
        contextShot: rows[0],
        unknownIntent: rows[0].intent === "unknown",
      });
    }
  }
  // Most repeatable first, then alphabetically; no invented cross-metric impact score.
  return {
    supported,
    observations: results,
    findings: results
      .filter((r) => r.hits >= 2)
      .sort(
        (a, b) =>
          b.hits - a.hits ||
          a.club.localeCompare(b.club) ||
          a.title.localeCompare(b.title),
      ),
  };
}
