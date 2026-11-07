import { useState } from "react";
import { NumberInput, Select } from "@mantine/core";
import { compareClubs, side, type Shot, type Metric, type Unit } from "./data";
import { practiceContext } from "./insights";

export function missCounts(values: number[], width: number) {
  const counts = [0, 0, 0];
  for (const v of values) counts[v < -width / 2 ? 0 : v > width / 2 ? 2 : 1]++;
  return counts;
}
export function missPeriods(rows: Shot[], metric: Metric, unit: Unit) {
  const dates = new Map<string, number[]>();
  for (const s of rows) {
    const v = side(s, metric, unit);
    if (s.quality !== "usable" || !s.session_date || v === null) continue;
    dates.set(s.session_date, [...(dates.get(s.session_date) ?? []), v]);
  }
  return [...dates]
    .filter(([, v]) => v.length >= 5)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);
}
function Band({
  label,
  counts,
  support,
}: {
  label: string;
  counts: number[];
  support: string;
}) {
  const n = counts.reduce((a, b) => a + b, 0);
  return (
    <div className="miss-band">
      <div className="miss-band-title">
        <strong>{label}</strong>
        <span>{support}</span>
      </div>
      <div className="miss-zones">
        {counts.map((v, i) => (
          <div key={i}>
            <span>{["Left", "Inside", "Right"][i]}</span>
            <strong>{n ? `${Math.round((v / n) * 100)}%` : "—"}</strong>
          </div>
        ))}
      </div>
      <div className="miss-strip" aria-hidden="true">
        {counts.map((v, i) => (
          <i key={i} style={{ flex: v || 0 }} />
        ))}
      </div>
    </div>
  );
}
export function MissPatterns({
  shots,
  metric,
  unit,
  widthM,
  onWidth,
}: {
  shots: Shot[];
  metric: Metric;
  unit: Unit;
  widthM: number;
  onWidth: (v: number) => void;
}) {
  const [club, setClub] = useState("");
  const [context, setContext] = useState("");
  const clubs = [
    ...new Map(
      shots
        .slice()
        .sort(compareClubs)
        .map((s) => [s.club_id, s]),
    ).values(),
  ];
  const chosen =
    clubs.find((s) => s.club_id === club) ??
    clubs.find(
      (s) => s.set_id === "set-a" && /^7\s*-?\s*iron$/i.test(s.club_label),
    ) ??
    clubs[0];
  const clubShots = shots.filter((s) => s.club_id === chosen?.club_id);
  const groups = [
    ...new Map(clubShots.map((s) => [practiceContext(s), s])).entries(),
  ];
  const key = groups.some(([k]) => k === context) ? context : groups[0]?.[0];
  const rows = clubShots.filter(
    (s) => practiceContext(s) === key && s.quality === "usable",
  );
  const values = rows
    .map((s) => side(s, metric, unit))
    .filter((v): v is number => v !== null);
  const width = widthM / (unit === "yd" ? 0.9144 : 1);
  const periods = missPeriods(rows, metric, unit);
  const comparison = (part: typeof periods) => {
    const perDate = part.map(([, v]) =>
      missCounts(v, width).map((c) => c / v.length),
    );
    return [0, 1, 2].map((i) => perDate.reduce((sum, c) => sum + c[i], 0));
  };
  return (
    <section className="miss-patterns">
      <h3>Where do my misses go?</h3>
      <div className="miss-controls">
        <Select
          label="Physical club"
          value={chosen?.club_id ?? null}
          onChange={(v) => v && setClub(v)}
          data={clubs.map((s) => ({
            value: s.club_id,
            label: `${s.club_label} · ${s.set_id}`,
          }))}
        />
        {groups.length > 1 && (
          <Select
            label="Measurement group"
            value={key}
            onChange={(v) => v && setContext(v)}
            data={groups.map(([k, s], i) => ({
              value: k,
              label: `${s.source} · ${s.normalization} · ${i + 1}`,
            }))}
          />
        )}
        <NumberInput
          label={`Target width (${unit})`}
          value={Number(width.toFixed(1))}
          min={1}
          max={200}
          step={5}
          onChange={(v) =>
            typeof v === "number" &&
            v > 0 &&
            onWidth(v * (unit === "yd" ? 0.9144 : 1))
          }
        />
      </div>
      <p className="practice-guide">
        {metric === "carry" ? "Landing" : "Finishing"} left/right · centered on
        your aim line. Dotted edges on the map use this width.
      </p>
      {!values.length && (
        <p className="practice-guide">
          No {metric === "carry" ? "landing" : "finishing"} left/right
          measurements for this selection.
          {metric === "carry" && rows.some((s) => s.total_side_m !== null)
            ? " Choose Total to see finishing misses."
            : ""}
        </p>
      )}
      <Band
        label="Selected shots"
        counts={missCounts(values, width)}
        support={`${values.length} shots · ${rows.length - values.length} missing left/right`}
      />
      {periods.length === 6 ? (
        <div className="miss-comparison">
          {[periods.slice(0, 3), periods.slice(3)].map((part, i) => (
            <Band
              key={i}
              label={i ? "Recent 3 dates" : "Earlier 3 dates"}
              counts={comparison(part)}
              support={`${part.reduce((n, [, v]) => n + v.length, 0)} shots · ${part[0][0]} – ${part[2][0]}`}
            />
          ))}
        </div>
      ) : (
        <p className="practice-guide">
          Earlier vs recent needs 6 dates with at least 5 measured shots each (
          {periods.length}/6 available).
        </p>
      )}
      <p className="practice-guide">
        Practice corridor, not fairways hit or predicted accuracy. Comparison
        gives each date equal weight; mishits stay included.
      </p>
    </section>
  );
}
