import { useMemo, useState, type CSSProperties } from "react";
import { Checkbox, SegmentedControl, Select } from "@mantine/core";
import { bagConsistency, type BagMetric } from "./bagConsistency";
import { type Shot, type Unit, shotKey } from "./data";
import { trendValue } from "./trends";
import { MeasurementContext } from "./MeasurementContext";

import { BagWindowBands } from "./PracticeVisuals";

function SpreadChange({ delta, unit }: { delta: number; unit: Unit }) {
  if (Number(delta.toFixed(1)) === 0)
    return <span className="spread-unchanged">Same width</span>;
  const direction = delta < 0 ? "narrower" : "wider";
  const yards = Math.abs(delta) / (unit === "m" ? 0.9144 : 1);
  const intensity = Math.min(yards / 10, 1);
  return (
    <span
      className={`spread-change spread-${direction}`}
      style={{ "--spread-strength": `${intensity * 100}%` } as CSSProperties}
    >
      {Math.abs(delta).toFixed(1)} {unit} {direction}
    </span>
  );
}

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
  const [metric, setMetric] = useState<BagMetric | "both">("both");
  const [widest, setWidest] = useState(false);
  const [expanded, setExpanded] = useState("");
  const sets = [...new Set(shots.map((s) => s.set_id))].sort();
  const active = sets.includes(set) ? set : (sets[0] ?? "");
  const carryRows = useMemo(
    () => bagConsistency(shots, active, "carry", unit, widest),
    [shots, active, unit, widest],
  );
  const sideRows = useMemo(
    () => bagConsistency(shots, active, "side", unit, widest),
    [shots, active, unit, widest],
  );
  const sideByKey = new Map(sideRows.map((row) => [row.key, row]));
  const rows = metric === "side" ? sideRows : carryRows;
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
            onChange={(v) => setMetric(v as typeof metric)}
            data={[
              { value: "both", label: "Both" },
              { value: "carry", label: "Distance" },
              { value: "side", label: "Direction" },
            ]}
          />
        </div>
        <Checkbox
          label={metric === "both" ? "Widest carry first" : "Widest first"}
          checked={widest}
          onChange={(e) => setWidest(e.currentTarget.checked)}
        />
      </div>
      {metric === "both" ? (
        <>
          <p className="practice-guide">
            Middle 80% of shots, in {unit}. Change compares the latest three
            eligible dates with the previous three for each measurement.
          </p>
          {!rows.length && (
            <p className="practice-empty">No clubs match this selection.</p>
          )}
          {rows.map((row) => (
            <article className="bag-row bag-pair" key={row.key}>
              <header>
                <strong>{row.club.club_label}</strong>
                <small>{row.club.source}</small>
              </header>
              {(["carry", "side"] as const).map((kind) => {
                const entry = kind === "carry" ? row : sideByKey.get(row.key)!;
                const { recent, change, limited } = entry;
                const label =
                  kind === "carry" ? "Carry spread" : "Left/right spread";
                return (
                  <button
                    type="button"
                    key={kind}
                    onClick={() => {
                      setExpanded(row.key);
                      setMetric(kind);
                    }}
                    aria-label={`Inspect ${row.club.club_label} ${label.toLowerCase()}`}
                  >
                    <small>{label}</small>
                    <strong>
                      {recent
                        ? recent.spread.toFixed(1) + " " + unit
                        : "No measurements"}
                    </strong>
                    {recent && (
                      <small>
                        {change === null ? (
                          limited ? (
                            "Small sample"
                          ) : (
                            "Awaiting baseline"
                          )
                        ) : (
                          <SpreadChange delta={change} unit={unit} />
                        )}
                      </small>
                    )}
                  </button>
                );
              })}
            </article>
          ))}
        </>
      ) : (
        <>
          <p className="practice-guide">
            {side
              ? "Finishing left/right · center line is your aim"
              : "Carry distance"}{" "}
            ({unit}). Band shows the middle 80% and dot shows the median.
          </p>
          <p className="practice-guide">
            Latest 3 eligible dates versus the previous 3. Each date counts
            equally. A comparison needs 5 measured shots on each date.
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
                      {change !== null && (
                        <strong>
                          <SpreadChange delta={change} unit={unit} />
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
                      {recent && (
                        <BagWindowBands
                          recent={recent}
                          earlier={earlier}
                          side={side}
                          unit={unit}
                        />
                      )}
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
        </>
      )}
    </section>
  );
}
