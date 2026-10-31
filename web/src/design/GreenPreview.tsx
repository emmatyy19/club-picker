import { GolfIron } from "./GolfIron";
import { useCallback, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Drawer,
  Group,
  MantineProvider,
  NumberInput,
  RangeSlider,
  SegmentedControl,
} from "@mantine/core";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/latin-800.css";
import "@fontsource/nunito-sans/latin-900.css";
import fixture from "../../../data/synthetic/showcase.json";
import {
  quantile,
  shotKey,
  parseSnapshot,
  clubOrder,
  distance,
  type Metric,
  type Unit,
} from "../data";
import { ShotChart } from "../Chart";
import {
  approachContext,
  approachProfiles,
  rankFinishApproaches,
} from "../approach";
import { greenTheme } from "./theme";
import "./green.css";

const shots = parseSnapshot(fixture).shots;
const clubs = [...new Set(shots.map((s) => s.club_label))].sort(
  (a, b) => clubOrder(a) - clubOrder(b),
);
const dates = [
  ...new Set(shots.flatMap((s) => (s.session_date ? [s.session_date] : []))),
].sort();
const units = [
  { label: "yd", value: "yd" },
  { label: "m", value: "m" },
];

function ClubArt() {
  return <GolfIron className="green-club-art" />;
}

export function GreenPreview() {
  const [page, setPage] = useState("shots");
  const [view, setView] = useState<"dispersion" | "overhead">("dispersion");
  const [metric, setMetric] = useState<Metric>("total");
  const [unit, setUnit] = useState<Unit>("yd");
  const [club, setClub] = useState("7 iron");
  const [sets, setSets] = useState(["set-a", "set-b"]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [combine, setCombine] = useState(false);
  const [selected, onSelect] = useState("");
  const [session, setSession] = useState("all");
  const [dateRange, setDateRange] = useState<[number, number]>([
    0,
    dates.length - 1,
  ]);
  const [pickerSet, setPickerSet] = useState("set-a");
  const [target, setTarget] = useState<string | number>(135);
  const [swing, setSwing] = useState("full");
  const [playsLike, setPlaysLike] = useState<string | number>("");
  const selectedShots = useMemo(
    () =>
      shots.filter(
        (s) =>
          s.club_label === club &&
          sets.includes(s.set_id) &&
          (session === "all" || s.session_date === session) &&
          s.session_date !== null &&
          s.session_date >= dates[dateRange[0]] &&
          s.session_date <= dates[dateRange[1]],
      ),
    [club, sets, session, dateRange],
  );
  const inspect = useCallback((id: string) => onSelect(id), []);
  const chosen = shots.find((s) => shotKey(s) === selected);
  const scale = unit === "yd" ? 1 / 0.9144 : 1;
  const rows = shots.filter(
    (s) =>
      s.set_id === pickerSet &&
      (s.intent === swing || (swing === "full" && s.intent === "unknown")),
  );
  const context = rows[0] ? approachContext(rows[0]) : "";
  const profiles = approachProfiles(rows, pickerSet, context);
  const targetNumber = Number(playsLike || target);
  const ranked =
    targetNumber > 0
      ? rankFinishApproaches(profiles, targetNumber / scale)
      : [];
  const best = ranked[0];
  const fmt = (m: number) => Math.round(m * scale);
  const totalSessions = new Set(shots.map((s) => s.session_id)).size;
  return (
    <MantineProvider theme={greenTheme} forceColorScheme="light">
      <div className="green-app">
        <div className="green-preview-note">
          THE GREEN <span>Design preview · synthetic data</span>
          <a href="./">Open current app ↗</a>
        </div>
        <header className="green-header">
          <a className="green-brand" href="?design=green">
            <img
              src={`${import.meta.env.BASE_URL}app-icon-512.png`}
              alt="Bunny caddie"
            />
            <span>
              my caddie<span className="green-brand-dot">.</span>
            </span>
          </a>
          <nav aria-label="Workspace">
            <button
              aria-current={page === "shots" ? "page" : undefined}
              onClick={() => setPage("shots")}
            >
              ◷ <span>My Shots</span>
            </button>
            <button
              aria-current={page === "approach" ? "page" : undefined}
              onClick={() => setPage("approach")}
            >
              ⚑ <span>Approach picker</span>
            </button>
          </nav>
          <Badge className="green-sample-badge" color="sage" variant="light">
            Synthetic library
          </Badge>
        </header>
        <main>
          {page === "shots" ? (
            <>
              <div className="green-title-row">
                <div>
                  <p className="green-eyebrow">YOUR PRACTICE BOOK</p>
                  <h1>
                    My Shots<span className="green-flower">✳</span>
                  </h1>
                </div>
                <div className="green-library" aria-label="Library totals">
                  {[
                    [shots.length.toLocaleString(), "shots"],
                    [totalSessions, "sessions"],
                    [
                      new Set(shots.map((s) => s.club_id)).size,
                      "physical clubs",
                    ],
                  ].map(([n, label]) => (
                    <div key={label}>
                      <strong>{n}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <section className="green-chart-panel" aria-label="Shot explorer">
                <div className="green-chart-top">
                  <div
                    className="green-view-tabs"
                    role="group"
                    aria-label="Chart view"
                  >
                    <button
                      aria-pressed={view === "dispersion"}
                      onClick={() => setView("dispersion")}
                    >
                      ▥ <span>Stats chart</span>
                    </button>
                    <button
                      aria-pressed={view === "overhead"}
                      onClick={() => setView("overhead")}
                    >
                      ◎ <span>Overhead</span>
                    </button>
                  </div>
                  <SegmentedControl
                    aria-label="Distance units"
                    data={units}
                    value={unit}
                    onChange={(v) => setUnit(v as Unit)}
                  />
                </div>
                <div className="green-toolbar">
                  <Button variant="default" onClick={() => setFilterOpen(true)}>
                    ☷ <span>Filters</span>
                    <Badge color="sage" variant="light">
                      {club}
                    </Badge>
                  </Button>
                  <label className="green-date-select">
                    <span>Dates</span>
                    <select
                      aria-label="Session date"
                      value={session}
                      onChange={(e) => setSession(e.target.value)}
                    >
                      <option value="all">All sessions</option>
                      {dates.map((d, i) => (
                        <option key={d} value={d}>
                          Session {i + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="green-metric">
                    <SegmentedControl
                      aria-label="Distance metric"
                      data={[
                        { label: "Carry", value: "carry" },
                        { label: "Total", value: "total" },
                      ]}
                      value={metric}
                      onChange={(v) => setMetric(v as Metric)}
                    />
                  </div>
                </div>
                <div className="green-chart-meta">
                  <span>
                    <strong>{selectedShots.length}</strong> shots selected
                  </span>
                  <Checkbox
                    label="Combine selection"
                    checked={combine}
                    onChange={(e) => setCombine(e.currentTarget.checked)}
                  />
                </div>
                <ShotChart
                  shots={selectedShots}
                  all={shots}
                  metric={metric}
                  unit={unit}
                  colorBy="set_id"
                  coverage={0.8}
                  dispersionMode={combine ? "combined" : "separate"}
                  view={view}
                  selected={selected}
                  onSelect={inspect}
                />
                <div className="green-timeline">
                  <div>
                    <strong>Practice sessions</strong>
                    <span>
                      Sessions {dateRange[0] + 1}–{dateRange[1] + 1} of{" "}
                      {dates.length}
                    </span>
                  </div>
                  <RangeSlider
                    aria-label="Session range"
                    min={0}
                    max={dates.length - 1}
                    step={1}
                    minRange={0}
                    value={dateRange}
                    onChange={(value) => {
                      setDateRange(value);
                      setSession("all");
                    }}
                    label={(value) => `Session ${value + 1}`}
                    thumbFromLabel="First session"
                    thumbToLabel="Last session"
                    size={36}
                    thumbSize={40}
                    styles={{
                      thumb: {
                        width: 14,
                        height: 40,
                        borderRadius: 0,
                        border: "2px solid #52734d",
                        background: "#fffdf7",
                      },
                      track: { background: "#f2f5eb", borderRadius: 0 },
                      bar: {
                        background: "rgba(82,115,77,0.2)",
                        borderRadius: 0,
                      },
                    }}
                  />
                  <div>
                    <span>Session 1</span>
                    <button
                      onClick={() => {
                        setDateRange([0, dates.length - 1]);
                        setSession("all");
                      }}
                    >
                      All sessions
                    </button>
                    <span>Session {dates.length}</span>
                  </div>
                </div>
                <div className="green-chart-footer">
                  <span>
                    Observed middle 80% ·{" "}
                    {view === "overhead"
                      ? "Flat-ground positions"
                      : "Reported distance vs. left/right"}
                  </span>
                  <span>Synthetic shots, illustrative spread</span>
                </div>
              </section>
              <section className="green-summary-strip">
                <div>
                  <span className="green-eyebrow">IN YOUR BAG</span>
                  <h2>{club}</h2>
                </div>
                {sets.map((set) => {
                  const data = selectedShots.filter((s) => s.set_id === set);
                  const values = data
                    .map((s) => distance(s, metric, unit))
                    .filter((v): v is number => v !== null)
                    .sort((a, b) => a - b);
                  return (
                    <div className="green-summary-item" key={set}>
                      <Badge
                        color={set === "set-a" ? "sage" : "grape"}
                        variant="light"
                      >
                        {set}
                      </Badge>
                      <strong>
                        {values.length
                          ? quantile(values, 0.5)!.toFixed(0)
                          : "—"}{" "}
                        <small>{unit}</small>
                      </strong>
                      <span>
                        Median {metric} · {data.length} shots
                      </span>
                    </div>
                  );
                })}
                <div className="green-inspection">
                  <span className="green-eyebrow">SHOT DETAILS</span>
                  <p>
                    {chosen
                      ? `${chosen.club_label} · ${chosen.set_id} · ${distance(chosen, metric, unit)?.toFixed(1)} ${unit}`
                      : "Select a dot to take a closer look."}
                  </p>
                </div>
              </section>
            </>
          ) : (
            <div className="green-picker">
              <div className="green-picker-heading">
                <p className="green-eyebrow">
                  A LITTLE HELP WITH THE NEXT SHOT
                </p>
                <h1>Approach picker</h1>
                <p>Start with where you want the ball to finish.</p>
              </div>
              <div className="green-picker-grid">
                <section className="green-input-card">
                  <div className="green-set-row">
                    <SegmentedControl
                      aria-label="Club set"
                      data={[
                        { value: "set-a", label: "Set A" },
                        { value: "set-b", label: "Set B" },
                      ]}
                      value={pickerSet}
                      onChange={setPickerSet}
                    />
                    <SegmentedControl
                      aria-label="Picker units"
                      data={units}
                      value={unit}
                      onChange={(v) => {
                        const next = v as Unit;
                        const ratio = next === "yd" ? 1 / 0.9144 : 0.9144;
                        setTarget(
                          typeof target === "number"
                            ? Math.round(target * ratio)
                            : "",
                        );
                        setPlaysLike(
                          typeof playsLike === "number"
                            ? Math.round(playsLike * ratio)
                            : "",
                        );
                        setUnit(next);
                      }}
                    />
                  </div>
                  <NumberInput
                    className="green-target"
                    label="Target distance"
                    value={target}
                    onChange={setTarget}
                    min={1}
                    max={600}
                    suffix={` ${unit}`}
                    placeholder="135"
                  />
                  <p className="green-field-hint">
                    Finish distance · carry is shown separately below.
                  </p>
                  <label className="green-field-label">Swing type</label>
                  <SegmentedControl
                    fullWidth
                    aria-label="Swing type"
                    value={swing}
                    onChange={setSwing}
                    data={[
                      { label: "Full swing", value: "full" },
                      { label: "Partial swing", value: "partial" },
                    ]}
                  />
                  <details className="green-slope">
                    <summary>
                      Slope adjustment <span>Optional</span>
                    </summary>
                    <NumberInput
                      label="Rangefinder plays-like distance"
                      value={playsLike}
                      onChange={setPlaysLike}
                      min={1}
                      suffix={` ${unit}`}
                    />
                    <p>
                      Use your rangefinder’s adjusted distance when available.
                    </p>
                  </details>
                  <div className="green-practice-note">
                    <span>✳</span>
                    <p>
                      Built from practice history.
                      <br />
                      This preview uses invented shots.
                    </p>
                  </div>
                </section>
                <section className="green-results" aria-live="polite">
                  {best ? (
                    <>
                      <article className="green-recommendation">
                        <span className="green-eyebrow">
                          CLOSEST PRACTICE FINISH
                        </span>
                        <h2>{best.club.club_label}</h2>
                        <strong className="green-swing-label">
                          {swing === "full" ? "Full swing" : "Partial swing"}
                        </strong>
                        <ClubArt />
                        <div className="green-result-distances">
                          <div>
                            <span>Typical finish</span>
                            <strong>
                              {best.total ? fmt(best.total.median) : "—"}{" "}
                              <small>{unit}</small>
                            </strong>
                          </div>
                          <div>
                            <span>Carry</span>
                            <strong>
                              {fmt(best.median)} <small>{unit}</small>
                            </strong>
                          </div>
                        </div>
                        <p>
                          Middle 80% carry: {fmt(best.low)}–{fmt(best.high)}{" "}
                          {unit}
                          <br />
                          {best.shots} shots · {best.sessions} practice sessions
                        </p>
                      </article>
                      <h3 className="green-alternative-label">
                        Also in your bag
                      </h3>
                      {ranked.slice(1, 3).map((r) => (
                        <article
                          className="green-alternative"
                          key={r.club.club_id}
                        >
                          <div>
                            <strong>{r.club.club_label}</strong>
                            <span>
                              {swing === "full"
                                ? "Full swing"
                                : "Partial swing"}
                            </span>
                          </div>
                          <div>
                            <span>Typical finish</span>
                            <strong>
                              {r.total ? fmt(r.total.median) : "—"}{" "}
                              <small>{unit}</small>
                            </strong>
                          </div>
                        </article>
                      ))}
                    </>
                  ) : (
                    <div className="green-empty">
                      <h2>
                        {targetNumber > 0
                          ? "No matching practice shots"
                          : "Choose a distance"}
                      </h2>
                      <p>
                        {targetNumber > 0
                          ? "Try full swing or another club set."
                          : "Enter a distance greater than zero to compare clubs."}
                      </p>
                    </div>
                  )}
                  <p className="green-result-note">
                    Descriptive practice results. Future shots may differ.
                  </p>
                </section>
              </div>
            </div>
          )}
        </main>
        <footer className="green-page-footer">
          <span>my caddie · The Green</span>
          <span>Design proof · illustrative data</span>
        </footer>
        <Drawer
          opened={filterOpen}
          onClose={() => setFilterOpen(false)}
          title="Find your shots"
          position="right"
          size="md"
        >
          <p className="green-drawer-label">Club</p>
          <div className="green-filter-chips">
            {clubs.map((c) => (
              <Button
                key={c}
                variant={club === c ? "filled" : "default"}
                onClick={() => setClub(c)}
                aria-pressed={club === c}
              >
                {c}
              </Button>
            ))}
          </div>
          <p className="green-drawer-label">Club sets</p>
          <Group>
            {["set-a", "set-b"].map((s) => (
              <Checkbox
                key={s}
                label={s === "set-a" ? "Set A" : "Set B"}
                checked={sets.includes(s)}
                onChange={() =>
                  setSets((prior) =>
                    prior.includes(s)
                      ? prior.filter((v) => v !== s)
                      : [...prior, s],
                  )
                }
              />
            ))}
          </Group>
          <Button mt="xl" fullWidth onClick={() => setFilterOpen(false)}>
            Show {selectedShots.length} shots
          </Button>
        </Drawer>
      </div>
    </MantineProvider>
  );
}
