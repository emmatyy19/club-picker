import { useMemo, useState } from "react";
import { Select } from "@mantine/core";
import { MeasurementContext } from "./MeasurementContext";
import { type Shot } from "./data";
import { practicePriorities } from "./priorities";
export function PrioritiesView({ shots }: { shots: Shot[] }) {
  const sets = [...new Set(shots.map((s) => s.set_id))].sort();
  const [set, selectSet] = useState("set-a");
  const active = sets.includes(set) ? set : sets[0];
  const { findings, supported, observations } = useMemo(
    () => practicePriorities(shots.filter((s) => s.set_id === active)),
    [shots, active],
  );
  const [showAll, setShowAll] = useState(false);
  const [metric, setMetric] = useState("width");
  const candidates = observations
    .filter((f) => f.kind === metric)
    .sort(
      (a, b) =>
        b.hits - a.hits ||
        Number(b.club === "7 iron") - Number(a.club === "7 iron") ||
        a.club.localeCompare(b.club),
    );
  const shown = showAll ? candidates : candidates.slice(0, 3);
  return (
    <section className="priorities-view">
      <h3>What deserves practice?</h3>
      <div className="priority-controls">
        <Select
          label="Club set"
          value={active ?? null}
          onChange={(v) => {
            if (v) selectSet(v);
            setShowAll(false);
          }}
          data={sets}
        />
        <Select
          label="Review"
          value={metric}
          onChange={(v) => {
            if (v) setMetric(v);
            setShowAll(false);
          }}
          data={[
            { value: "width", label: "Carry consistency" },
            { value: "short", label: "Short shots" },
            { value: "left", label: "Left misses" },
            { value: "right", label: "Right misses" },
          ]}
        />
      </div>
      <p className="practice-guide">
        Latest 3 eligible dates per club and measurement group · at least 10
        shots per date. These are screening suggestions, not a swing diagnosis.
      </p>
      <p className="practice-guide">
        {findings.length
          ? `${findings.length} repeated or watch patterns across all checks.`
          : "No repeated warning flags. Your measurements are still shown below."}
      </p>
      {!candidates.length && (
        <div className="miss-band">
          {supported
            ? "Not enough valid measurements for this check. Try another metric or widen the date filters."
            : "Needs three dates with at least 10 usable shots per club and measurement group. Widen your date filters to include more practice."}
        </div>
      )}
      {shown.map((f) => (
        <article className="miss-band" key={f.key}>
          <div className="miss-band-title">
            <strong>
              {f.club} · {f.set} · {f.source}
            </strong>
            <span>
              {f.hits === 3
                ? "Repeated · 3/3 dates"
                : f.hits === 2
                  ? "Watch · 2/3 dates"
                  : `Observed · ${f.hits}/3 above threshold`}
            </span>
          </div>
          <details className="inline-help priority-context">
            <summary>Measurement details</summary>
            <MeasurementContext shot={f.contextShot} />
          </details>
          <h4>
            {f.kind === "width"
              ? "Carry spread"
              : f.kind === "short"
                ? "Short-shot frequency"
                : `Finishing ${f.kind} of target`}
          </h4>
          <p className="practice-guide">
            {f.kind === "width"
              ? "Middle 80% carry range as a share of median carry. Marker: 30%."
              : f.kind === "short"
                ? "Shots below 80% of that date’s median carry. Marker: 20%."
                : "Shots finishing more than 5 yd on this side. Marker: 60%."}
          </p>
          <div className="priority-dates">
            {f.dates.map((d) => (
              <div key={d.date}>
                <span>{d.date}</span>
                <div className="priority-meter">
                  <i
                    style={{
                      width: `${(d.value / Math.max(1, ...f.dates.map((v) => v.value))) * 100}%`,
                    }}
                  />
                  <b
                    style={{
                      left: `${(f.threshold / Math.max(1, ...f.dates.map((v) => v.value))) * 100}%`,
                    }}
                  />
                </div>
                <strong>{Math.round(d.value * 100)}%</strong>
                <small>{d.n} shots</small>
              </div>
            ))}
          </div>
          <p className="practice-guide">
            {f.hits < 2
              ? "No repeated threshold crossing in these dates."
              : f.kind === "width" || f.kind === "short"
                ? "Practice focus: repeat one stock carry with this club and track the spread."
                : "Practice focus: repeat shots at a clear aim line and track the sideways miss."}
            {f.unknownIntent &&
              " Swing intent was not recorded; deliberate partial swings could explain some of this."}
          </p>
        </article>
      ))}
      {candidates.length > 3 && (
        <button className="priority-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show ${candidates.length - 3} more groups`}
        </button>
      )}
      <details className="inline-help">
        <summary>How these suggestions work</summary>
        <p>
          Green bars show each date’s result; the line marks the screening
          threshold. Three dates crossing it earn “Repeated”; two earn “Watch”.
          These provisional thresholds were not validated as coaching standards.
          Groups stay separate by physical club, source, intent and measurement
          settings. Mishits stay included; missing side measurements are
          omitted. Ordering favors repeatability, then the 7-iron and club name,
          not predicted handicap benefit. Carry and side screens may use
          different numbers of shots. This view uses your date filters, not
          playback.
        </p>
      </details>
    </section>
  );
}
