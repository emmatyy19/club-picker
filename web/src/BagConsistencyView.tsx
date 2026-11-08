import { useMemo, useState } from "react";
import { Checkbox, SegmentedControl, Select } from "@mantine/core";
import { bagConsistency, type BagMetric } from "./bagConsistency";
import { type Shot, type Unit, shotKey } from "./data";
import { trendValue } from "./trends";
import { MeasurementContext } from "./MeasurementContext";

export function BagConsistency({
  shots,
  unit,
  onSelect,
}: {
  shots: Shot[];
  unit: Unit;
  onSelect: (key: string) => void;
}) {
  const [set, setSet] = useState("set-a");
  const [metric, setMetric] = useState<BagMetric>("carry");
  const [widest, setWidest] = useState(false);
  const [expanded, setExpanded] = useState("");
  const sets = [...new Set(shots.map((s) => s.set_id))].sort();
  const active = sets.includes(set) ? set : (sets[0] ?? "");
  const rows = useMemo(
    () => bagConsistency(shots, active, metric, unit, widest),
    [shots, active, metric, unit, widest],
  );
  const side = metric === "side";
  const bands = rows.flatMap((r) => (r.recent ? [r.recent] : []));
  const extent = Math.max(
    1,
    ...bands.map((b) => Math.max(Math.abs(b.low), Math.abs(b.high))),
  );
  const pos = (value: number) =>
    side ? 50 + (50 * value) / extent : (100 * value) / extent;
  const fmt = (value: number) =>
    side && value !== 0
      ? Math.abs(value).toFixed(1) +
        " " +
        unit +
        (value < 0 ? " left" : " right")
      : value.toFixed(1) + " " + unit;
  return (
    <section className="bag-consistency">
      <div className="bag-controls">
        {sets.length > 0 && (
          <div>
            <span className="control-label">Club set</span>
            <SegmentedControl
              aria-label="Consistency club set"
              value={active}
              onChange={setSet}
              data={sets}
            />
          </div>
        )}
        <div>
          <span className="control-label">Control</span>
          <SegmentedControl
            aria-label="Consistency measurement"
            value={metric}
            onChange={(v) => setMetric(v as BagMetric)}
            data={[
              { value: "carry", label: "Distance" },
              { value: "side", label: "Direction" },
            ]}
          />
        </div>
        <Checkbox
          label="Widest first"
          checked={widest}
          onChange={(e) => setWidest(e.currentTarget.checked)}
        />
      </div>
      <p className="practice-guide">
        {side
          ? "Finishing left/right · center line is your aim"
          : "Carry distance"}{" "}
        ({unit}). Band shows the middle 80% and dot shows the median.
      </p>
      <p className="practice-guide">
        Latest 3 eligible dates versus the previous 3. Each date counts equally.
        A comparison needs 5 measured shots on each date.
      </p>
      {!rows.length && (
        <p className="practice-empty">No clubs match this selection.</p>
      )}
      {rows.map(
        ({ key, club, recent, earlier, limited, change, rows: group }) => {
          const open = expanded === key;
          const visibleDates = new Set([
            ...(recent?.dates ?? []),
            ...(earlier?.dates ?? []),
          ]);
          const delta = change === null ? null : Number(change.toFixed(1));
          return (
            <article className="bag-row" key={key}>
              <button
                type="button"
                className="bag-summary"
                aria-expanded={open}
                onClick={() => setExpanded(open ? "" : key)}
              >
                <span>
                  <strong>{club.club_label}</strong>
                  <small>{club.source}</small>
                </span>
                <span
                  className={"bag-track" + (side ? " bag-aim" : "")}
                  aria-hidden="true"
                >
                  {recent && (
                    <>
                      <i
                        style={{
                          left: pos(recent.low) + "%",
                          width: pos(recent.high) - pos(recent.low) + "%",
                        }}
                      />
                      <b style={{ left: pos(recent.median) + "%" }} />
                    </>
                  )}
                </span>
                <span>
                  {recent ? (
                    <>
                      <strong>
                        {recent.spread.toFixed(1)} {unit} wide
                      </strong>
                      <small>
                        {side ? "Typical finish" : "Typical carry"}{" "}
                        {fmt(recent.median)}
                      </small>
                    </>
                  ) : (
                    <small>
                      No dated {side ? "finishing offsets" : "carries"}
                    </small>
                  )}
                </span>
                <span>
                  {delta !== null && (
                    <strong>
                      {delta === 0
                        ? "Same width"
                        : Math.abs(delta).toFixed(1) +
                          " " +
                          unit +
                          (delta > 0 ? " wider" : " narrower")}
                    </strong>
                  )}
                  {recent && (
                    <small>
                      {recent.shots} shots · {recent.dates.length}{" "}
                      {recent.dates.length === 1 ? "date" : "dates"}
                      {limited ? " · small sample" : ""}
                    </small>
                  )}
                </span>
                <span aria-hidden="true">{open ? "▴" : "▾"}</span>
              </button>
              {open && (
                <div className="bag-detail">
                  {(
                    [
                      ["Recent", recent],
                      ["Earlier", earlier],
                    ] as const
                  ).map(([label, summary]) => {
                    if (!summary) return null;
                    return (
                      <p key={label}>
                        <strong>{label}</strong> · {fmt(summary.low)} to{" "}
                        {fmt(summary.high)} · {summary.dates.join(", ")}
                      </p>
                    );
                  })}
                  {recent && (
                    <Select
                      label="Inspect a measured shot"
                      value={null}
                      placeholder="Choose a shot"
                      onChange={(v) => v && onSelect(v)}
                      data={group
                        .filter(
                          (s) =>
                            s.quality === "usable" &&
                            s.session_date &&
                            visibleDates.has(s.session_date) &&
                            trendValue(s, metric, unit, "total") !== null,
                        )
                        .map((s, i) => ({
                          value: shotKey(s),
                          label:
                            s.session_date +
                            " · #" +
                            (i + 1) +
                            " · " +
                            fmt(trendValue(s, metric, unit, "total")!),
                        }))}
                    />
                  )}
                  <details>
                    <summary>Measurement settings</summary>
                    <MeasurementContext shot={club} />
                  </details>
                </div>
              )}
            </article>
          );
        },
      )}
    </section>
  );
}
