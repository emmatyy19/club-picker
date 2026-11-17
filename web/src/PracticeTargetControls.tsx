import { useState } from "react";
import {
  scoreTarget,
  type TargetSize,
  type targetClubs,
} from "./practiceTarget";
import type { Metric, Unit, Shot } from "./data";

function DimensionInput({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit: Unit;
}) {
  const scale = unit === "yd" ? 0.9144 : 1;
  const shown = Number((value / scale).toFixed(1));
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label>
      {label} ({unit})
      <input
        type="number"
        min="0.1"
        max="1000"
        step="0.1"
        value={draft ?? shown}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          const n = Number(raw);
          if (n >= 0.1 && n <= 1000) onChange(n * scale);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

export function PracticeTargetControls({
  size,
  onSize,
  choice,
  onSet,
  onFirst,
  onSecond,
  shots,
  metric,
  unit,
}: {
  size: TargetSize;
  onSize: (s: TargetSize) => void;
  choice: ReturnType<typeof targetClubs>;
  onSet: (id: string) => void;
  onFirst: (id: string) => void;
  onSecond: (id: string) => void;
  shots: Shot[];
  metric: Metric;
  unit: Unit;
}) {
  const { sets, set, clubs, a, b } = choice;
  return (
    <section
      className="overhead-target-panel"
      aria-label="Practice target settings"
    >
      <div className="target-fields">
        {(["distance", "width", "depth"] as const).map((k) => (
          <DimensionInput
            key={k + unit}
            unit={unit}
            label={
              k === "distance"
                ? "Target distance"
                : k === "width"
                  ? "Width"
                  : "Depth"
            }
            value={size[k]}
            onChange={(v) => onSize({ ...size, [k]: v })}
          />
        ))}
      </div>
      <div className="target-fields">
        <label>
          Club set
          <select value={set ?? ""} onChange={(e) => onSet(e.target.value)}>
            {sets.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {[a, b].map((club, i) => (
          <label key={i}>
            Club {i + 1}
            <select
              disabled={!club}
              value={club?.club_id ?? ""}
              onChange={(e) => (i === 0 ? onFirst : onSecond)(e.target.value)}
            >
              {!club && <option value="">Unavailable</option>}
              {clubs
                .filter((s) => i === 0 || s.club_id !== a?.club_id)
                .map((s) => (
                  <option key={s.club_id} value={s.club_id}>
                    {s.club_label}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>
      <div className="target-results">
        {[a, b].map((club) => {
          if (!club) return null;
          const rows = shots.filter((s) => s.club_id === club.club_id);
          const score = scoreTarget(rows, metric, size);
          return (
            <div key={club.club_id}>
              <strong>{club.club_label}</strong>
              <span>
                {score.plotted
                  ? `${score.hits} of ${score.plotted} inside · ${Math.round((100 * score.hits) / score.plotted)}%`
                  : "No plottable shots"}
              </span>
              <small>
                {score.plotted} of {rows.length} shots plotted · {score.dates}{" "}
                practice {score.dates === 1 ? "date" : "dates"}
              </small>
            </div>
          );
        })}
      </div>
    </section>
  );
}
