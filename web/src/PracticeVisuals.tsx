import { useState } from "react";
import { SegmentedControl, Select, Tooltip } from "@mantine/core";
import {
  comparisonGroups,
  distanceGroups,
  sharedClubDates,
  type Distribution,
} from "./insights";
import { format, type Metric, type Shot, type Unit } from "./data";
import { trendUnit, type TrendMetric } from "./trends";
import "./practice-visuals.css";

const signed = (v: number, precision = 1) => {
  const rounded = Number(v.toFixed(precision));
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(precision)}`;
};
function domain(summaries: Distribution[]) {
  const low = Math.min(...summaries.map((s) => s.low));
  const high = Math.max(...summaries.map((s) => s.high));
  const pad = Math.max(1, high - low) * 0.1;
  return [low - pad, high + pad] as const;
}
function comparisonRange(
  summaries: Distribution[],
  metric: TrendMetric,
): readonly [number, number] {
  if (metric === "spread")
    return [0, Math.max(1, ...summaries.map((s) => s.spread)) * 1.1];
  const range = domain(summaries);
  return metric === "side" || metric === "curve"
    ? [Math.min(range[0], 0), Math.max(range[1], 0)]
    : range;
}
function Axis({
  range,
  suffix,
}: {
  range: readonly [number, number];
  suffix: string;
}) {
  const decimals = Math.max(
    0,
    Math.min(3, Math.ceil(-Math.log10((range[1] - range[0]) / 4))),
  );
  return (
    <div className="practice-axis" aria-hidden="true">
      <span />
      <div>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i}>
            {(range[0] + ((range[1] - range[0]) * i) / 4).toFixed(decimals)}
          </span>
        ))}
      </div>
      <span>{suffix}</span>
    </div>
  );
}
function Band({
  label,
  summary,
  range,
  suffix,
  recent = false,
  widthOnly = false,
  target = false,
  precision = 1,
}: {
  label: string;
  summary: Distribution;
  range: readonly [number, number];
  suffix: string;
  recent?: boolean;
  widthOnly?: boolean;
  target?: boolean;
  precision?: number;
}) {
  const display = (value: number) => value.toFixed(precision);
  const pos = (v: number) =>
    `${((v - range[0]) / (range[1] - range[0])) * 100}%`;
  const description = `${widthOnly ? `80% width ${display(summary.spread)}` : `Median ${display(summary.median)}`} ${suffix}. Middle 80%: ${display(summary.low)}–${display(summary.high)} ${suffix}. ${summary.shots} shots on ${summary.dates.length} dates. ${summary.dates.join(", ")}.`;
  return (
    <details className="practice-band-details">
      <summary
        className={`practice-band ${recent ? "is-recent" : ""}`}
        aria-label={`${label}. ${description}`}
      >
        <span className="practice-band-label">
          <span>{label}</span>
          <svg
            className="practice-chevron"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              d="m4 6 4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="practice-band-track">
          {target && (
            <span className="practice-target" style={{ left: pos(0) }} />
          )}
          <span
            className="practice-band-interval"
            style={{
              left: widthOnly ? "0%" : pos(summary.low),
              width: `${((summary.high - summary.low) / (range[1] - range[0])) * 100}%`,
            }}
          />
          {!widthOnly && (
            <span
              className="practice-band-dot"
              style={{ left: pos(summary.median) }}
            />
          )}
        </span>
        <strong>{display(widthOnly ? summary.spread : summary.median)}</strong>
      </summary>
      <div className="practice-band-facts">
        <div>
          <span>Middle 80%</span>
          <strong>
            {display(summary.low)}–{display(summary.high)} {suffix}
          </strong>
        </div>
        <div>
          <span>Measurements</span>
          <strong>
            {summary.shots} shots · {summary.dates.length} dates
          </strong>
        </div>
        <div className="practice-fact-dates">
          <span>Practice dates</span>
          <div>
            {summary.dates.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
function Context({
  shot,
  combined = false,
}: {
  shot: Shot;
  combined?: boolean;
}) {
  return (
    <Tooltip
      label={
        combined
          ? "Explicitly combines your selected clubs and measurement settings. Changes may reflect a different mixture of shots."
          : `${shot.set_id} · ${shot.source} · ${shot.intent} swing · ${shot.normalization} · ${shot.normalization_settings} · ${shot.carry_basis} carry · ${shot.total_basis} total · ${shot.compensation} compensation · ${shot.session_mode} · ${shot.ball_type} ball · ${shot.surface}`
      }
      multiline
      w={300}
      events={{ hover: true, focus: true, touch: true }}
    >
      <button className="practice-context" type="button">
        {combined ? "Combined selection" : `${shot.set_id} · ${shot.source}`}
        <span className="chart-info" aria-hidden="true">
          i
        </span>
      </button>
    </Tooltip>
  );
}
export function PracticeComparison({
  shots,
  metric,
  unit,
  lateral,
  combined,
}: {
  shots: Shot[];
  metric: TrendMetric;
  unit: Unit;
  lateral: Metric;
  combined: boolean;
}) {
  // Spread uses the underlying signed side distribution, not per-shot deviations.
  const groups = comparisonGroups(shots, metric, unit, lateral, combined);
  const suffix = trendUnit(metric, unit);
  const precision = metric === "smash" ? 2 : 1;
  const summaries = groups.flatMap((g) =>
    g.earlier && g.recent ? [g.earlier, g.recent] : [],
  );
  const range = summaries.length
    ? comparisonRange(summaries, metric)
    : ([0, 1] as const);
  return (
    <div className="practice-comparisons">
      <div className="practice-key">
        <span>
          <i /> Earlier 3 dates
        </span>
        <span>
          <i className="recent-key" /> Recent 3 dates
        </span>
      </div>
      {groups.length === 0 && (
        <p className="practice-empty">Select a club with dated measurements.</p>
      )}
      {groups.map((g, i) => (
        <section
          className="practice-card"
          key={g.key}
          aria-label={`Practice comparison ${i + 1}`}
        >
          <header>
            <Context shot={g.shot} combined={combined} />
            <span>
              {g.eligible} practice {g.eligible === 1 ? "date" : "dates"}
            </span>
          </header>
          {g.earlier && g.recent ? (
            <>
              <Axis range={range} suffix={suffix} />
              <Band
                precision={precision}
                label="Earlier"
                summary={g.earlier}
                range={range}
                widthOnly={metric === "spread"}
                target={metric === "side" || metric === "curve"}
                suffix={suffix}
              />
              <Band
                precision={precision}
                label="Recent"
                summary={g.recent}
                range={range}
                widthOnly={metric === "spread"}
                target={metric === "side" || metric === "curve"}
                suffix={suffix}
                recent
              />
              <div className="practice-deltas">
                {metric !== "spread" && (
                  <span>
                    Median{" "}
                    <strong>
                      {signed(g.recent.median - g.earlier.median, precision)}{" "}
                      {suffix}
                    </strong>
                  </span>
                )}
                <span>
                  80% width{" "}
                  <strong>
                    {signed(g.recent.spread - g.earlier.spread, precision)}{" "}
                    {suffix}
                  </strong>
                </span>
              </div>
              <p className="practice-window">
                {g.earlier.dates[0]} – {g.earlier.dates.at(-1)} <span>→</span>{" "}
                {g.recent.dates[0]} – {g.recent.dates.at(-1)}
              </p>
            </>
          ) : (
            <p className="practice-empty">
              {g.measuredDates === 0
                ? `No dated measurements for this metric.${(metric === "side" || metric === "spread") && lateral === "carry" ? " Try finishing left/right." : ""}`
                : `${g.eligible} of 6 practice dates · 5 measured shots per date needed`}
            </p>
          )}
        </section>
      ))}
      <p className="practice-guide">
        {metric === "spread"
          ? "Bar: middle 80% width"
          : "Dot: median · Band: middle 80%"}{" "}
        · Each date has equal weight
        {metric === "spread" ? ". Lower means a narrower spread." : ""}
        {metric === "side" ? ". Negative = left; positive = right." : ""}
      </p>
    </div>
  );
}
type DistanceGroup = ReturnType<typeof distanceGroups>[number];

function preferredIron(group: DistanceGroup, number: number) {
  return group.bands.find(
    (b) =>
      b.shot.club_label.toLowerCase().replace(/[- ]/g, "") === `${number}iron`,
  );
}

function PairComparison({
  group,
  metric,
  unit,
}: {
  group: DistanceGroup;
  metric: Metric;
  unit: Unit;
}) {
  const [choiceA, setA] = useState("");
  const [choiceB, setB] = useState("");
  const { bands } = group;
  const a =
    bands.find((b) => b.shot.club_id === choiceA) ??
    preferredIron(group, 7) ??
    bands[0];
  const others = bands.filter((b) => b !== a);
  const preferredB = preferredIron(group, 8);
  const b =
    others.find((b) => b.shot.club_id === choiceB) ??
    others.find((b) => b === preferredB) ??
    others[0];
  if (!a || !b)
    return (
      <p className="practice-empty">
        Select at least two clubs from the same set and measurement group.
      </p>
    );
  const dates = sharedClubDates(a.values, b.values);
  const range = dates.length
    ? domain(dates.flatMap((d) => [d.a, d.b]))
    : undefined;
  const options = (list: typeof bands) =>
    list.map((c) => ({ value: c.shot.club_id, label: c.shot.club_label }));
  return (
    <section className="practice-card">
      <header>
        <Context shot={group.shot} />
        <span>
          {dates.length} shared {dates.length === 1 ? "date" : "dates"}
        </span>
      </header>
      <div className="priority-controls">
        <Select
          label="First club"
          value={a.shot.club_id}
          data={options(bands)}
          onChange={(v) => v && setA(v)}
          allowDeselect={false}
        />
        <Select
          label="Second club"
          value={b.shot.club_id}
          data={options(others)}
          onChange={(v) => v && setB(v)}
          allowDeselect={false}
        />
      </div>
      <p className="practice-guide">
        {metric === "carry" ? "Carry" : "Total"} · Dot: median · Band: middle
        80% · Gap: {a.shot.club_label} minus {b.shot.club_label}.
      </p>
      {!range && (
        <p className="practice-empty">
          No shared dates with five usable measurements for each club. Try a
          wider date range or another pair.
        </p>
      )}
      {range &&
        dates.map((d) => (
          <div key={d.date} className="pair-date">
            <header>
              <strong>{d.date}</strong>
              <span>
                {signed(d.gap)} {unit} gap
              </span>
            </header>
            <Axis range={range} suffix={unit} />
            <Band
              label={a.shot.club_label}
              summary={d.a}
              range={range}
              suffix={unit}
              recent
            />
            <Band
              label={b.shot.club_label}
              summary={d.b}
              range={range}
              suffix={unit}
            />
            <small>
              {d.a.shots} and {d.b.shots} shots, respectively
            </small>
          </div>
        ))}
    </section>
  );
}

export function ClubDistances({
  shots,
  metric,
  unit,
}: {
  shots: Shot[];
  metric: Metric;
  unit: Unit;
}) {
  const groups = distanceGroups(shots, metric, unit);
  const [groupKey, setGroupKey] = useState("");
  const [layout, setLayout] = useState("bag");
  const preferredGroup =
    layout === "pair"
      ? groups.find((g) => {
          const a = preferredIron(g, 7),
            b = preferredIron(g, 8);
          return (
            g.shot.set_id === "set-a" &&
            a &&
            b &&
            [...a.values.keys()].some((date) => b.values.has(date))
          );
        })
      : undefined;
  const active =
    groups.find((g) => g.key === groupKey) ?? preferredGroup ?? groups[0];
  const summaries = groups.flatMap((g) =>
    g.bands.flatMap((b) => (b.summary ? [b.summary] : [])),
  );
  const range = summaries.length ? domain(summaries) : ([0, 1] as const);
  return (
    <div className="practice-distance-groups">
      <SegmentedControl
        aria-label="Club gap view"
        value={layout}
        onChange={setLayout}
        data={[
          { value: "bag", label: "Bag overview" },
          { value: "pair", label: "Compare two clubs" },
        ]}
      />
      {groups.length > 1 && (
        <Select
          className="practice-group-select"
          label="Club set & source"
          aria-label="Club distance group"
          value={active?.key ?? null}
          onChange={(v) => setGroupKey(v ?? "")}
          allowDeselect={false}
          data={groups.map((g, i) => ({
            value: g.key,
            label: `${g.shot.set_id} · ${g.shot.source}${groups.filter((other) => other.shot.set_id === g.shot.set_id && other.shot.source === g.shot.source).length > 1 ? ` · group ${i + 1}` : ""}`,
          }))}
        />
      )}

      {layout === "pair" && active ? (
        <PairComparison
          key={active.key}
          group={active}
          metric={metric}
          unit={unit}
        />
      ) : (
        <>
          <p className="practice-guide">
            {metric === "carry" ? "Carry" : "Reported total"} · Dot: median ·
            Band: middle 80% · Gaps compare shared dates
          </p>
          {!groups.length && (
            <p className="practice-empty">No shots match this selection.</p>
          )}
          {(active ? [active] : []).map((g, i) => (
            <section
              className="practice-card"
              key={g.key}
              aria-label={`Club distances ${i + 1}`}
            >
              <header>
                <Context shot={g.shot} />
                <span>Selected dates</span>
              </header>
              <Axis range={range} suffix={unit} />
              {g.bands.map((b) => (
                <div key={b.shot.club_id}>
                  {b.summary ? (
                    <Band
                      label={b.shot.club_label}
                      summary={b.summary}
                      range={range}
                      suffix={unit}
                      recent
                    />
                  ) : (
                    <div className="practice-sparse">
                      <span>{b.shot.club_label}</span>
                      <span>5 shots on a date needed</span>
                    </div>
                  )}
                  {b.next && (
                    <div className="practice-gap">
                      <Tooltip
                        label={
                          b.gap === null
                            ? `No comparable dates with ${b.next}. Missing clubs are not skipped.`
                            : `${b.shot.club_label}: ${format(b.paired!.first.median)} ${unit}; ${b.next}: ${format(b.paired!.second.median)} ${unit}. Medians on ${b.sharedDates} shared dates, with ${b.paired!.first.shots} and ${b.paired!.second.shots} shots. Each date has at least 5 shots per club. A negative gap reverses the normal club order.`
                        }
                        multiline
                        w={280}
                        events={{ hover: true, focus: true, touch: true }}
                      >
                        <span tabIndex={0}>
                          {b.gap === null
                            ? "No shared dates"
                            : `${signed(b.gap)} ${unit} gap`}
                          {b.gap !== null && (
                            <small>
                              {`${b.sharedDates} ${b.sharedDates === 1 ? "date" : "dates"}`}
                            </small>
                          )}
                        </span>
                      </Tooltip>
                    </div>
                  )}
                </div>
              ))}
            </section>
          ))}
          <p className="practice-guide">
            Equal weight per date · Select a band for shots and dates. Overlap
            shows shared distance ranges, not a probability.
          </p>
        </>
      )}
    </div>
  );
}
