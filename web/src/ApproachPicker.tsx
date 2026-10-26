import { useMemo, useState } from "react";
import { Checkbox, NumberInput, SegmentedControl, Select } from "@mantine/core";
import {
  carryWindow,
  type CarryWindow,
  approachContext,
  approachEligible,
  approachProfiles,
  approachTarget,
  rankFinishApproaches,
} from "./approach";
import { MeasurementContext } from "./MeasurementContext";
import type { Shot, Unit } from "./data";

export function ApproachPicker({ shots }: { shots: Shot[] }) {
  const [set, setSet] = useState("");
  const [context, setContext] = useState("");
  const [untagged, setUntagged] = useState(true);
  const [swing, setSwing] = useState("full");
  const [unit, setUnit] = useState<Unit>("yd");
  const [distance, setDistance] = useState<number | string>("");
  const [playsLike, setPlaysLike] = useState<number | string>("");
  const [mustCarry, setMustCarry] = useState<number | string>("");
  const [front, setFront] = useState<number | string>("");
  const [back, setBack] = useState<number | string>("");
  const [useWindow, setUseWindow] = useState(false);
  const [angle, setAngle] = useState<number | string>("");
  const sets = [
    ...new Set(shots.filter(approachEligible).map((s) => s.set_id)),
  ].sort();
  const chosenSet = sets.includes(set) ? set : (sets[0] ?? "");
  const contexts = useMemo(() => {
    const result = new Map<string, Shot>();
    for (const s of shots)
      if (
        approachEligible(s) &&
        s.set_id === chosenSet &&
        (s.intent === swing ||
          (swing === "full" && untagged && s.intent === "unknown"))
      )
        result.set(approachContext(s), s);
    return [...result.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [shots, chosenSet, untagged, swing]);
  const chosenContext = contexts.some(([key]) => key === context)
    ? context
    : (contexts[0]?.[0] ?? "");
  const sample = contexts.find(([key]) => key === chosenContext)?.[1];
  const profiles = useMemo(
    () => approachProfiles(shots, chosenSet, chosenContext),
    [shots, chosenSet, chosenContext],
  );
  let target: number | null = null,
    error = "";
  if (distance !== "") {
    try {
      target = approachTarget(
        Number(distance),
        playsLike === "" ? null : Number(playsLike),
        angle === "" ? null : Number(angle),
        unit,
      );
    } catch (e) {
      error = (e as Error).message;
    }
  }
  let window: CarryWindow | null = null;
  if (useWindow) {
    try {
      if (front === "" || back === "")
        throw Error("Enter both front and back carry distances.");
      window = carryWindow(Number(front), Number(back), unit);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  let clearance: number | null = null;
  if (mustCarry !== "") {
    try {
      clearance = approachTarget(Number(mustCarry), null, null, unit);
    } catch {
      error = "Must carry must be greater than zero.";
    }
  }
  if (window && clearance !== null && clearance >= window.back)
    error = "The landing area must extend beyond the must-carry distance.";
  const ranked =
    target === null || error
      ? []
      : rankFinishApproaches(profiles, target, window, clearance);
  const scale = unit === "yd" ? 0.9144 : 1;
  const show = (m: number) => (m / scale).toFixed(1);
  function changeUnits(next: Unit) {
    const ratio = unit === "yd" ? 0.9144 : 1 / 0.9144;
    const convert = (v: number | string) =>
      v === "" ? "" : Number((Number(v) * ratio).toFixed(4));
    setDistance(convert(distance));
    setPlaysLike(convert(playsLike));
    setMustCarry(convert(mustCarry));
    setFront(convert(front));
    setBack(convert(back));
    setUnit(next);
  }
  return (
    <section
      className="panel approach-picker"
      aria-label="Approach shot picker"
    >
      <div className="approach-heading">
        <div>
          <h2>Approach shots</h2>
          <p className="muted">
            Choose a set, enter a distance, and compare your clubs.
          </p>
        </div>
        <SegmentedControl
          aria-label="Approach distance units"
          value={unit}
          onChange={(v) => changeUnits(v as Unit)}
          data={["yd", "m"]}
        />
      </div>
      <div className="approach-set-row">
        <div className="approach-toggle-field">
          <span className="approach-field-label">Club set</span>
          <SegmentedControl
            aria-label="Club set"
            value={chosenSet}
            onChange={(v) => {
              setSet(v);
              setContext("");
            }}
            data={sets.map((value) => ({
              value,
              label: value.replace(
                /^set-([a-z])$/,
                (_, letter: string) => `Set ${letter.toUpperCase()}`,
              ),
            }))}
          />
        </div>
      </div>
      <div className="approach-inputs">
        <NumberInput
          label={`Finish near (${unit})`}
          placeholder="Pin or finishing target"
          value={distance}
          onChange={setDistance}
          min={0}
          hideControls
        />
        <NumberInput
          label={`Plays like (${unit}, optional)`}
          placeholder="From your rangefinder"
          value={playsLike}
          onChange={setPlaysLike}
          min={0}
          hideControls
        />
        <NumberInput
          label="Slope angle (°, optional)"
          placeholder="+ uphill, − downhill"
          value={angle}
          onChange={setAngle}
          min={-89.9}
          max={89.9}
          hideControls
        />
      </div>
      <div className="approach-data">
        <div className="approach-toggle-field">
          <span className="approach-field-label">Swing</span>
          <SegmentedControl
            aria-label="Swing type"
            value={swing}
            onChange={(v) => {
              setSwing(v);
              setContext("");
            }}
            data={[
              { value: "full", label: "Full swing" },
              { value: "partial", label: "Partial swing" },
            ]}
          />
        </div>
        {contexts.length > 1 && (
          <Select
            label="Practice data"
            value={chosenContext}
            allowDeselect={false}
            onChange={(v) => setContext(v ?? "")}
            data={contexts.map(([key, s], i) => ({
              value: key,
              label: `${s.source === "manual" ? "Manual" : s.source === "trackman" ? "Trackman" : "Toptracer"} · ${s.intent === "unknown" ? "swing assumed" : s.intent === "partial" ? "partial swings" : "full swings"}${contexts.filter(([, other]) => other.source === s.source && other.intent === s.intent).length > 1 ? ` · settings ${i + 1}` : ""}`,
            }))}
          />
        )}
      </div>
      <div className="approach-window">
        <NumberInput
          className="must-carry-input"
          label={`Must carry (${unit}, optional)`}
          description="Distance beyond water, a bunker, or another obstacle."
          placeholder="Far edge of obstacle"
          value={mustCarry}
          onChange={setMustCarry}
          min={0}
          hideControls
        />
        <Checkbox
          label="Add a landing area"
          checked={useWindow}
          onChange={(e) => setUseWindow(e.currentTarget.checked)}
        />
        {useWindow && (
          <>
            <div className="approach-window-inputs">
              <NumberInput
                label={`Landing area front (${unit})`}
                placeholder="Near edge"
                value={front}
                onChange={setFront}
                min={0}
                hideControls
              />
              <NumberInput
                label={`Landing area back (${unit})`}
                placeholder="Far edge"
                value={back}
                onChange={setBack}
                min={0}
                hideControls
              />
            </div>
            <p className="muted small">
              Use level-ground carry distances, or plays-like distances for both
              edges on a slope. The target’s slope adjustment is not applied to
              these fields.
            </p>
          </>
        )}
      </div>
      <div className="approach-results" aria-live="polite">
        {error ? (
          <p role="alert">{error}</p>
        ) : target === null ? (
          <p className="muted">
            Enter where you want the ball to finish to compare clubs.
          </p>
        ) : !ranked.length ? (
          <p className="muted">
            {swing === "partial"
              ? "No labeled partial swings in this set yet. Add a practice session with a repeatable partial swing, such as a three-quarter swing, before using it for recommendations."
              : "No matching full-swing data. In Practice settings below, include shots with unknown swing intent to use your imported history."}
          </p>
        ) : (
          <>
            <p>
              Finish reference:{" "}
              <strong>
                {show(target)} {unit}
              </strong>
              {playsLike !== ""
                ? " · rangefinder plays-like distance"
                : " · reported total comparison"}
            </p>
            {clearance !== null && ranked.every((p) => p.clears === 0) && (
              <p role="status">
                None of these clubs has a recorded carry beyond that obstacle
                distance.
              </p>
            )}
            {clearance !== null && (
              <p className="muted small">
                With a landing area, rank by carries that both clear and land in
                range, then reported finish. Without one, clearance comes first.
                Historical carries beyond the obstacle are not a safety
                guarantee. Compare the long miss as well.
              </p>
            )}
            {window && (
              <p className="muted small">
                Observed carries between {show(window.front)} and{" "}
                {show(window.back)} {unit}, including the edges. Equal weight
                per session. This is not a green-hit probability; sideways
                misses and rollout are not included.
              </p>
            )}
            <div className="approach-cards">
              {ranked.slice(0, 3).map((p, i) => (
                <article
                  className={`approach-card ${i === 0 ? "approach-best" : ""}`}
                  key={p.club.club_id}
                >
                  <span className="muted small">
                    {i === 0
                      ? window
                        ? "Most practice carries fitting the plan"
                        : clearance !== null
                          ? "Highest observed clearance"
                          : p.total
                            ? "Closest reported finish"
                            : "Carry evidence only"
                      : "Alternative"}
                  </span>
                  <h3>{p.club.club_label}</h3>
                  <p className="approach-swing">
                    {p.club.intent === "partial"
                      ? "Partial swing · recorded practice"
                      : p.club.intent === "full"
                        ? "Full swing"
                        : "Full swing · assumed"}
                  </p>
                  <div className="approach-distances">
                    <div>
                      <span>Typical carry</span>
                      <strong>
                        {show(p.median)} <small>{unit}</small>
                      </strong>
                    </div>
                    <div>
                      <span>Reported total</span>
                      <strong>
                        {p.total ? show(p.total.median) : "Unknown"}{" "}
                        {p.total && <small>{unit}</small>}
                      </strong>
                    </div>
                  </div>
                  <p>
                    {p.gap === null
                      ? "No reported total for finish comparison"
                      : Math.abs(p.gap / scale) < 0.05
                        ? "Reported finish matches target"
                        : `Reported finish: ${show(Math.abs(p.gap))} ${unit} ${p.gap < 0 ? "short" : "long"}`}
                  </p>
                  {p.fits !== null && clearance !== null && (
                    <p>
                      <strong>{(p.fits * 100).toFixed(1)}%</strong> of practice
                      carries both clear and land in range.
                    </p>
                  )}
                  {p.clears !== null && (
                    <p className="clearance-result">
                      <strong>{(p.clears * 100).toFixed(1)}%</strong> of
                      session-weighted practice carries beyond{" "}
                      {show(clearance!)} {unit}. Not a guarantee of clearing the
                      obstacle.
                    </p>
                  )}
                  <p className="muted small">
                    Reported total includes provider bounce and roll
                    assumptions, not today’s ground conditions.
                  </p>
                  {p.outcomes && (
                    <div className="carry-window-results">
                      <div className="carry-window-bar" aria-hidden="true">
                        {(["short", "within", "long"] as const).map((key) => (
                          <span
                            key={key}
                            className={`window-${key}`}
                            style={{ width: `${p.outcomes![key] * 100}%` }}
                          />
                        ))}
                      </div>
                      <div className="carry-window-labels">
                        {(["short", "within", "long"] as const).map((key) => (
                          <div key={key}>
                            <strong>
                              {(p.outcomes![key] * 100).toFixed(1)}%
                            </strong>
                            <span>
                              {key === "within"
                                ? "In range"
                                : key === "short"
                                  ? "Short"
                                  : "Long"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <dl>
                    <div>
                      <dt>Middle 80% carry</dt>
                      <dd>
                        {show(p.low)}–{show(p.high)} {unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Reported total support</dt>
                      <dd>
                        {p.total
                          ? `${p.total.shots} shots · ${p.total.sessions} ${p.total.sessions === 1 ? "session" : "sessions"}`
                          : "No data"}
                      </dd>
                    </div>
                    <div>
                      <dt>Carry history</dt>
                      <dd>
                        {p.history.dates} practice{" "}
                        {p.history.dates === 1 ? "date" : "dates"} · {p.shots}{" "}
                        shots
                        {p.history.undatedShots > 0 &&
                          ` (${p.history.undatedShots} undated)`}
                      </dd>
                    </div>
                    <div>
                      <dt>Latest practice</dt>
                      <dd>{p.latest ?? "Date unknown"}</dd>
                    </div>
                  </dl>
                  <div className="approach-history">
                    {(p.history.dates < 5 || p.shots < 20) && (
                      <span className="history-badge">Limited history</span>
                    )}
                    {p.history.comparison ? (
                      <>
                        <div className="approach-history-values">
                          <div>
                            <span>Recent carry</span>
                            <strong>
                              {show(p.history.comparison.recent.median)} {unit}
                            </strong>
                            <small>
                              Latest 3 dates ·{" "}
                              {p.history.comparison.recent.shots} shots
                            </small>
                          </div>
                          <div>
                            <span>Earlier carry</span>
                            <strong>
                              {show(p.history.comparison.earlier.median)} {unit}
                            </strong>
                            <small>
                              {p.history.comparison.earlier.sessions} earlier
                              dates · {p.history.comparison.earlier.shots} shots
                            </small>
                          </div>
                        </div>
                        <p className="muted small">
                          {Math.abs(
                            (p.history.comparison.recent.median -
                              p.history.comparison.earlier.median) /
                              scale,
                          ) < 0.05
                            ? "Recent carry is unchanged."
                            : `Recent carry is ${show(Math.abs(p.history.comparison.recent.median - p.history.comparison.earlier.median))} ${unit} ${p.history.comparison.recent.median > p.history.comparison.earlier.median ? "longer" : "shorter"}.`}{" "}
                          Recorded change, not a forecast.
                        </p>
                      </>
                    ) : (
                      <p className="muted small">
                        Recent comparison needs 5 dated practice days: 3 recent
                        and at least 2 earlier.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <p className="muted small">
              Observed carry ranges, not a prediction of your next shot.
              Sessions have equal weight.{" "}
              {sample?.intent === "unknown" &&
                "Full swing is assumed for unlabeled practice shots. Their original labels are unchanged."}
            </p>
          </>
        )}
      </div>
      <details className="approach-context">
        <summary>
          Practice settings{sample ? ` · ${sample.source}` : ""}
        </summary>
        <Checkbox
          label="Include shots with unknown swing intent"
          description="Used as full-swing practice. Turn off if your untagged history includes deliberate partial swings."
          checked={untagged}
          onChange={(e) => {
            setUntagged(e.currentTarget.checked);
            setContext("");
          }}
        />
        {sample && <MeasurementContext shot={sample} />}
      </details>
      <details className="approach-context">
        <summary>How this suggestion works</summary>
        <p>
          With no constraints, clubs are ordered by closest reported total. With
          a landing area, carries meeting both landing and clearance constraints
          take priority. Otherwise, supplied clearance comes first. Reported
          finish breaks ties. This explicit ordering does not optimize a
          combined hazard cost. A club can clear more often yet finish too long;
          compare all three results. Sets and practice settings stay separate.
          All usable shots, including mishits, contribute. Explorer filters do
          not change this comparison.
        </p>
        <p>
          A plays-like distance replaces the finish reference for comparison; it
          does not model changed bounce or roll. Must-carry and landing-area
          distances are independent level-ground-equivalent carry inputs. Use
          their own plays-like distances on a slope. The slope angle is context
          only and is not applied again. Without plays-like yardage, slope is
          not corrected. Wind, lie, rollout, and hazards are not modeled yet.
        </p>
        <p>
          Recent and earlier carry are date-balanced medians from separate
          periods. Undated shots stay in the overall recommendation but are
          excluded from that comparison. Five dates is a display minimum, not a
          reliability guarantee; the comparison does not change ranking.
        </p>
        <p>
          The middle 80% describes recorded carry variation with equal weight
          per session. It is not an 80% chance of hitting a green. This baseline
          has not been validated on the course.
        </p>
      </details>
      {angle !== "" && playsLike === "" && (
        <p className="muted small">
          Slope is not applied. Add your rangefinder’s plays-like distance to
          account for it.
        </p>
      )}
    </section>
  );
}
