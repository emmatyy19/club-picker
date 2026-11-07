import { useState } from "react";
import { Select } from "@mantine/core";
import { compareClubs, type Shot, type Unit } from "./data";
import { practiceContext, summarizeDates } from "./insights";

export function rolloutSummary(shots: Shot[], unit: Unit) {
  const paired = shots.filter(
    (s) => s.quality === "usable" && s.total_m !== null && s.session_date,
  );
  const days = new Map<string, Shot[]>();
  for (const s of paired)
    days.set(s.session_date!, [...(days.get(s.session_date!) ?? []), s]);
  const eligible = [...days]
    .filter(([, rows]) => rows.length >= 5)
    .sort(([a], [b]) => a.localeCompare(b));
  if (!eligible.length) return null;
  const factor = unit === "yd" ? 0.9144 : 1;
  const summary = (value: (s: Shot) => number) =>
    summarizeDates(
      new Map(
        eligible.map(([d, rows]) => [d, rows.map((s) => value(s) / factor)]),
      ),
    );
  return {
    carry: summary((s) => s.carry_m),
    total: summary((s) => s.total_m!),
    rollout: summary((s) => s.total_m! - s.carry_m),
    negative: eligible
      .flatMap(([, rs]) => rs)
      .filter((s) => s.total_m! < s.carry_m).length,
    omitted: shots.length - eligible.reduce((n, [, rs]) => n + rs.length, 0),
  };
}
export function RolloutView({ shots, unit }: { shots: Shot[]; unit: Unit }) {
  const [selected, setSelected] = useState("");
  const groups = [
    ...new Map(
      shots.map((s) => [JSON.stringify([s.set_id, practiceContext(s)]), s]),
    ).entries(),
  ];
  const active =
    groups.find(([k]) => k === selected) ??
    groups.find(([, s]) => s.set_id === "set-a") ??
    groups[0];
  const rows = shots.filter(
    (s) => JSON.stringify([s.set_id, practiceContext(s)]) === active?.[0],
  );
  const clubs = [
    ...new Map(
      rows
        .slice()
        .sort(compareClubs)
        .map((s) => [s.club_id, s]),
    ).values(),
  ];
  const summaries = clubs.map((shot) => ({
    shot,
    result: rolloutSummary(
      rows.filter((s) => s.club_id === shot.club_id),
      unit,
    ),
  }));
  const max =
    Math.max(
      1,
      ...summaries.flatMap(({ result: r }) =>
        r ? [r.carry.median, r.total.median] : [],
      ),
    ) * 1.05;
  return (
    <section className="rollout-view">
      <Select
        label="Club set & source"
        value={active?.[0] ?? null}
        onChange={(v) => v && setSelected(v)}
        data={groups.map(([key, s], i) => ({
          value: key,
          label: `${s.set_id} · ${s.source}${groups.filter(([, r]) => r.set_id === s.set_id && r.source === s.source).length > 1 ? ` · group ${i + 1}` : ""}`,
        }))}
      />
      <div className="rollout-legend">
        <span>
          <i />
          Carry median
        </span>
        <span>
          <i />
          Total median
        </span>
        <span>{unit}</span>
      </div>
      <p className="practice-guide">
        Reported rollout = total − carry on each shot. Each date has equal
        weight.
      </p>
      {summaries.map(({ shot, result: r }) => (
        <article className="rollout-club" key={shot.club_id}>
          <header>
            <strong>{shot.club_label}</strong>
            <span>
              {r
                ? `${r.rollout.shots} paired shots · ${r.rollout.dates.length} dates`
                : "Needs 5 paired shots on a date"}
            </span>
          </header>
          {r && (
            <>
              <div
                className="rollout-distance"
                role="img"
                aria-label={`Median carry ${r.carry.median.toFixed(1)}, total ${r.total.median.toFixed(1)} ${unit}`}
              >
                <i
                  className="rollout-carry"
                  style={{ width: `${(r.carry.median / max) * 100}%` }}
                />
                <i
                  className="rollout-extension"
                  style={{
                    left: `${(Math.min(r.carry.median, r.total.median) / max) * 100}%`,
                    width: `${(Math.abs(r.total.median - r.carry.median) / max) * 100}%`,
                  }}
                />
                <b style={{ left: `${(r.total.median / max) * 100}%` }} />
              </div>
              <div className="rollout-numbers">
                <span>
                  Carry <strong>{r.carry.median.toFixed(1)}</strong>
                </span>
                <span>
                  Total <strong>{r.total.median.toFixed(1)}</strong>
                </span>
                <span>
                  Rollout{" "}
                  <strong>
                    {r.rollout.median.toFixed(1)} {unit}
                  </strong>
                </span>
              </div>
              <p className="practice-guide">
                Middle 80% rollout: {r.rollout.low.toFixed(1)}–
                {r.rollout.high.toFixed(1)} {unit}
                {r.negative > 0
                  ? ` · ${r.negative} negative differences retained`
                  : ""}
                {r.omitted > 0
                  ? ` · ${r.omitted} shots without eligible pairs omitted`
                  : ""}
              </p>
            </>
          )}
        </article>
      ))}
      {!summaries.length && (
        <p className="practice-empty">No shots match these filters.</p>
      )}
      <details className="inline-help">
        <summary>About rollout</summary>
        <p>
          The bar endpoints are median carry and median total from the same
          paired shots. Rollout is calculated per shot before taking its median,
          so it may differ from subtracting the two displayed medians. It is a
          reported distance difference, not the exact ground path. Modeled
          ground conditions, landing angle and spin can affect it. Different
          club dates and unknown swing intent can also affect comparisons. Club
          sets and measurement contexts remain separate.
        </p>
        {active && (
          <p>
            {active[1].source} · {active[1].normalization} ·{" "}
            {active[1].normalization_settings} · surface: {active[1].surface}
          </p>
        )}
      </details>
    </section>
  );
}
