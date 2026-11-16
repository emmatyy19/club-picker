import { useMemo, useState } from "react";
import {
  type Filters,
  type Shot,
  type Unit,
  emptyFilters,
  filterShots,
} from "./data";
import { sessionRecap } from "./sessionRecap";
import { SpreadChange } from "./SpreadChange";
import { BagWindowBands } from "./PracticeVisuals";

export function SessionRecap({
  shots,
  date,
  filters,
  unit,
}: {
  shots: Shot[];
  date: string;
  filters: Filters;
  unit: Unit;
}) {
  const rows = useMemo(
    () =>
      sessionRecap(
        filterShots(shots, {
          ...emptyFilters,
          tags: filters.tags,
          mode: filters.mode,
        }),
        date,
        unit,
      ),
    [shots, date, filters.tags, filters.mode, unit],
  );
  const [expanded, setExpanded] = useState("");
  return (
    <details open className="session-recap">
      <summary>Session recap · {date}</summary>
      <p className="practice-guide">
        Middle 80% this session compared with the previous three eligible
        practice dates. Each date needs five measured shots.
      </p>
      {!rows.length && <p>No clubs match these filters for this date.</p>}
      {rows.map((row) => (
        <article key={row.key} className="bag-row bag-pair">
          <header>
            <strong>{row.club.club_label}</strong>
            <small>
              {row.club.set_id} · {row.club.source}
            </small>
          </header>
          {(["carry", "side"] as const).map((metric) => {
            const { recent, earlier, count, priorCount } = row[metric];
            const key = row.key + metric;
            const label =
              metric === "carry" ? "Carry spread" : "Finishing left/right";
            return (
              <button
                type="button"
                key={metric}
                disabled={!recent || !earlier}
                aria-expanded={expanded === key}
                onClick={() => setExpanded(expanded === key ? "" : key)}
              >
                <small>{label}</small>
                <strong>
                  {recent
                    ? recent.spread.toFixed(1) + " " + unit
                    : count + " measured shots"}
                </strong>
                <small>
                  {recent && earlier ? (
                    <SpreadChange
                      delta={recent.spread - earlier.spread}
                      unit={unit}
                    />
                  ) : recent ? (
                    priorCount + " of 3 prior dates"
                  ) : (
                    "5 needed"
                  )}
                </small>
              </button>
            );
          })}
          {(["carry", "side"] as const).map((metric) => {
            const { recent, earlier } = row[metric];
            return expanded === row.key + metric && recent && earlier ? (
              <div className="recap-bands" key={metric}>
                <BagWindowBands
                  recent={recent}
                  earlier={earlier}
                  recentLabel="Session"
                  earlierLabel="Prior 3"
                  side={metric === "side"}
                  unit={unit}
                />
              </div>
            ) : null;
          })}
        </article>
      ))}
    </details>
  );
}
