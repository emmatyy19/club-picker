import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  FileButton,
  Group,
  Modal,
  SegmentedControl,
  Select,
  Table,
  TextInput,
} from "@mantine/core";
import { ApproachPicker } from "./ApproachPicker";
import { ShotChart } from "./Chart";
import { MeasurementContext as Context } from "./MeasurementContext";
import type { DispersionMode } from "./dispersion";
import { Trends } from "./TrendView";
import { Rankings } from "./RankingView";
import { trendMetrics, trendUnit, trendValue } from "./trends";
import { Timeline } from "./Timeline";
import { Playback, useDatePlayback } from "./DatePlayback";
import { playbackDates } from "./playback";
import {
  color,
  clubOrder,
  compareClubs,
  plottedShots,
  setColor,
  distance,
  ellipse,
  emptyFilters,
  filterExpression,
  filterShots,
  format,
  groups,
  parseSnapshot,
  quantile,
  sessionKey,
  shotKey,
  side,
  type Dimension,
  type Filters,
  type Metric,
  type Shot,
  type Snapshot,
  type Unit,
} from "./data";
import { download, loadLibrary, loadRepoLibrary, saveLibrary } from "./storage";

const dimensions: { field: Dimension; label: string }[] = [
  { field: "club_label", label: "Club type" },
  { field: "source", label: "Source" },
  { field: "set_id", label: "Club set" },
  { field: "club_id", label: "Physical club" },
];

const showcase = import.meta.env.MODE === "showcase";
const preferencesKey = showcase
  ? "club-picker.showcase.preferences.v1"
  : "club-picker.preferences.v1";
const savedViewKey = showcase
  ? "club-picker.showcase.saved-view.v1"
  : "club-picker.saved-view.v1";
type Preferences = {
  metric: Metric;
  unit: Unit;
  colorBy: Dimension;
  view: "dispersion" | "distance" | "overhead" | "trends" | "rankings";
  coverage: string;
  dispersionMode: DispersionMode;
  trendCombine: boolean;
  separateTrendGroups: boolean;
};
const defaults: Preferences = {
  metric: import.meta.env.MODE === "showcase" ? "total" : "carry",
  unit: "yd",
  colorBy: "club_id",
  view: "dispersion",
  coverage: "0.8",
  dispersionMode: "separate",
  trendCombine: false,
  separateTrendGroups: true,
};
function preferences(): Preferences {
  try {
    const p = JSON.parse(
      localStorage.getItem(preferencesKey) ?? "null",
    ) as Preferences | null;
    if (
      p &&
      ["carry", "total"].includes(p.metric) &&
      ["yd", "m"].includes(p.unit) &&
      dimensions.some((d) => d.field === p.colorBy) &&
      ["dispersion", "distance", "overhead", "trends", "rankings"].includes(
        p.view,
      ) &&
      ["0", "0.5", "0.8"].includes(p.coverage)
    )
      return {
        ...p,
        trendCombine: p.trendCombine === true,
        separateTrendGroups: p.separateTrendGroups !== false,
        dispersionMode:
          p.dispersionMode === "combined" ? "combined" : "separate",
      };
  } catch {
    /* Recover noncritical preferences with defaults. */
  }
  return defaults;
}
export function App() {
  const [library, setLibrary] = useState<Snapshot | null>(null),
    [pending, setPending] = useState<Snapshot | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [persistent, setPersistent] = useState(true);
  const [prefs, setPrefs] = useState(preferences),
    [filters, setFilters] = useState<Filters>(emptyFilters),
    [selected, setSelected] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [setNames, setSetNames] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0),
    [savedView, setSavedView] = useState<Filters | null>(null);
  const [workspace, setWorkspace] = useState("shots");
  const [details, setDetails] = useState(false);
  const [selectionPanels, setSelectionPanels] = useState<string[]>([]);
  const [trendDates, setTrendDates] = useState<string[] | null>(null);
  const updateTrendDates = useCallback(
    (next: string[]) =>
      setTrendDates((prior) =>
        JSON.stringify(prior) === JSON.stringify(next) ? prior : next,
      ),
    [],
  );
  const [settings, setSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [librarySource, setLibrarySource] = useState<"repo" | "browser">(
    "browser",
  );
  const refreshData = async () => {
    setRefreshing(true);
    setError("");
    setNotice("");
    try {
      const snapshot = await loadRepoLibrary();
      if (!snapshot)
        throw new Error(
          "No processed repo library yet. Add your source files to data/raw, then have them extracted and reviewed.",
        );
      setLibrary(snapshot);
      setLibrarySource("repo");
      setSelected("");
      setNotice(
        `Updated from repo: ${snapshot.shots.length} shots. Filters kept.`,
      );
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : "Refresh failed."} Your current library is unchanged.`,
      );
    } finally {
      setRefreshing(false);
    }
  };
  const initialized = useRef(false);
  const accept = useCallback((snapshot: Snapshot) => {
    let saved = true;
    try {
      saveLibrary(snapshot);
    } catch {
      saved = false;
      setError(
        "Your browser could not save this library. You can explore it for now; export a backup before closing.",
      );
    }
    setPersistent(saved);
    setLibrary(snapshot);
    setLibrarySource("browser");
    setFilters(emptyFilters);
    setSelected("");
    setPage(0);
  }, []);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const init = async () => {
      if (import.meta.env.DEV || import.meta.env.MODE === "showcase") {
        try {
          const snapshot = await loadRepoLibrary();
          if (snapshot) {
            setLibrary(snapshot);
            setLibrarySource("repo");
            return;
          }
          setNotice(
            "No processed repo library found. Showing a browser backup if available.",
          );
        } catch {
          setError(
            "The repo library could not be read. Showing a browser backup if available. Refresh data to retry.",
          );
        }
      }
      try {
        setLibrary(loadLibrary());
      } catch {
        setPersistent(false);
        setError(
          "The browser backup could not be read. Restore a valid backup in Data settings or refresh the processed repo library.",
        );
      }
    };
    void init().finally(() => setReady(true));
    try {
      const raw = localStorage.getItem(savedViewKey);
      if (raw) {
        const f = JSON.parse(raw) as Filters;
        if (
          Array.isArray(f.tags) &&
          f.tags.every(
            (t) =>
              dimensions.some((d) => d.field === t.field) &&
              typeof t.value === "string",
          ) &&
          ["all", "any", "grouped"].includes(f.mode) &&
          typeof f.start === "string" &&
          typeof f.end === "string" &&
          typeof f.session === "string" &&
          typeof f.undated === "boolean"
        )
          setSavedView(f);
      }
    } catch {
      /* Invalid saved view does not affect shots. */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(prefs));
    } catch {
      setNotice("View preferences could not be saved on this device.");
    }
  }, [prefs]);
  useEffect(() => setPage(0), [filters, library]);
  const all = library?.shots ?? [];
  const filtered = useMemo(() => filterShots(all, filters), [all, filters]);
  const baseDates = useMemo(
    () =>
      playbackDates(
        plottedShots(
          filtered,
          prefs.metric,
          prefs.view === "trends" || prefs.view === "rankings"
            ? "distance"
            : prefs.view,
        ),
      ),
    [filtered, prefs.metric, prefs.view],
  );
  const dates =
    prefs.view === "trends" && trendDates !== null ? trendDates : baseDates;
  const playback = useDatePlayback(dates, JSON.stringify([filters, dates]));
  const playbackDate = playback.state.date;
  const matched = useMemo(
    () =>
      playbackDate === null
        ? filtered
        : filtered.filter((s) =>
            prefs.view === "trends"
              ? s.session_date !== null && s.session_date <= playbackDate
              : s.session_date === playbackDate,
          ),
    [filtered, playbackDate, prefs.view],
  );
  const usable = matched.filter((s) => s.quality === "usable");
  const measured = usable.filter(
    (s) => distance(s, prefs.metric, prefs.unit) !== null,
  );
  const paired = measured.filter(
    (s) => side(s, prefs.metric, prefs.unit) !== null,
  );
  const plotted = plottedShots(
    matched,
    prefs.metric,
    prefs.view === "trends" || prefs.view === "rankings"
      ? "distance"
      : prefs.view,
  );
  const grouped = groups(matched, prefs.metric);
  const chosen = matched.find((s) => shotKey(s) === selected);
  const filterSummary = filters.tags.length
    ? filters.tags
        .map((tag) => {
          const club =
            tag.field === "club_id"
              ? all.find((shot) => shot.club_id === tag.value)
              : undefined;
          return club ? `${club.club_label} · ${club.set_id}` : tag.value;
        })
        .join(" · ")
    : "All shots";
  const chosenSession = all.find(
    (shot) => sessionKey(shot) === filters.session,
  );
  const dateSummary = chosenSession
    ? `${chosenSession.session_date ?? "Undated"} · ${chosenSession.source} · ${chosenSession.set_id}`
    : filters.undated
      ? "Undated sessions"
      : filters.start && filters.end
        ? `${filters.start} to ${filters.end}`
        : filters.start
          ? `From ${filters.start}`
          : filters.end
            ? `Through ${filters.end}`
            : "All dates";
  const backToChart = () =>
    document
      .getElementById("shot-visualization")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  const revealSelection = (panel: string) => {
    setSelectionPanels((prior) =>
      prior.includes(panel) ? prior : [...prior, panel],
    );
    window.requestAnimationFrame(() =>
      document
        .getElementById(`shot-${panel}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const updatePrefs = (p: Partial<Preferences>) =>
    setPrefs((v) => ({ ...v, ...p }));
  const startImport = async (file: File | null) => {
    if (!file || showcase) return;
    setError("");
    setNotice("");
    try {
      if (file.size > 20_000_000)
        throw Error("Snapshot is larger than the 20 MB import limit.");
      const snapshot = parseSnapshot(JSON.parse(await file.text()));
      setPending(snapshot);
      setSetNames(
        Object.fromEntries(
          snapshot.shots.map((s) => [sessionKey(s), s.set_id]),
        ),
      );
      setConfirmed(false);
    } catch (e) {
      setError(
        `Import stopped. ${e instanceof Error ? e.message : "Invalid snapshot."}`,
      );
    }
  };
  const finishImport = () => {
    if (!pending || !confirmed) return;
    try {
      const snapshot = parseSnapshot({
        ...pending,
        shots: pending.shots.map((s) => ({
          ...s,
          set_id: setNames[sessionKey(s)]?.trim(),
        })),
      });
      accept(snapshot);
      setPending(null);
      setNotice(
        `Loaded ${snapshot.shots.length} unique shots. Previous library replaced with this snapshot.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import.");
    }
  };
  const saveView = () => {
    try {
      localStorage.setItem(savedViewKey, JSON.stringify(filters));
      setSavedView(filters);
      setNotice("Saved this filter and date selection.");
    } catch {
      setError("Could not save these filters.");
    }
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src={`${import.meta.env.BASE_URL}bunny-caddie.svg`}
            alt="Bunny caddie"
          />{" "}
          club picker
          <span className="brand-divider" />{" "}
          <span className="brand-section">My shots</span>
        </div>
        <span className="local-label">
          <i /> {showcase ? "Interactive demo" : "Local workspace"}
        </span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <h1>{workspace === "shots" ? "My Shots" : "Approach picker"}</h1>
          </div>
          <Group gap="sm">
            {import.meta.env.DEV && !showcase && (
              <Button
                loading={refreshing}
                disabled={!ready}
                onClick={() => void refreshData()}
              >
                Refresh data
              </Button>
            )}
            <Button
              variant="default"
              disabled={refreshing || !ready}
              onClick={() => setSettings(true)}
            >
              {showcase ? "About this demo" : "Data settings"}
            </Button>
          </Group>
        </div>
        <div className="feedback-stack" aria-live="polite">
          {error && (
            <Alert
              color="red"
              title="Needs attention"
              withCloseButton
              onClose={() => setError("")}
              mb="md"
            >
              {error}
            </Alert>
          )}
          {notice && (
            <Alert
              color="teal"
              withCloseButton
              onClose={() => setNotice("")}
              mb="md"
            >
              {notice}
            </Alert>
          )}
        </div>
        {!ready ? (
          <section className="panel empty">Opening your local library…</section>
        ) : !library ? (
          <section className="panel empty">
            <h2>No shots yet</h2>
            <p>
              Add PDFs, screenshots, or report links to data/raw, then have the
              session extracted and reviewed.
            </p>
            <p className="muted small">
              Once the processed library is ready, choose Refresh data.
            </p>
          </section>
        ) : (
          <>
            {import.meta.env.MODE === "showcase" && (
              <p className="showcase-note">
                <strong>Synthetic showcase</strong> · Generated from summary
                statistics of my private shot data. Shots and dates are
                invented.
              </p>
            )}
            <div className="inventory">
              <div>
                <strong>{all.length}</strong>
                <span>shots in your library</span>
              </div>
              <div>
                <strong>{new Set(all.map(sessionKey)).size}</strong>
                <span>practice sessions</span>
              </div>
              <div>
                <strong>{new Set(all.map((s) => s.club_id)).size}</strong>
                <span>physical clubs</span>
              </div>
              <div className="inventory-note">
                <span className="status-dot" />
                <span>
                  {librarySource === "repo"
                    ? import.meta.env.MODE === "showcase"
                      ? "Synthetic data"
                      : "From your repo"
                    : persistent
                      ? "Browser backup"
                      : "Temporary browser copy"}
                  <small>
                    {librarySource === "repo"
                      ? import.meta.env.MODE === "showcase"
                        ? "Illustration, not actual sessions."
                        : "Refresh after processing new sessions."
                      : "Repo files are unchanged."}
                  </small>
                </span>
              </div>
            </div>
            <SegmentedControl
              className="workspace-tabs"
              aria-label="Workspace"
              size="md"
              value={workspace}
              onChange={(value) => {
                playback.dispatch({ type: "pause" });
                setWorkspace(value);
              }}
              data={[
                { label: "My Shots", value: "shots" },
                { label: "Approach picker", value: "approach" },
              ]}
            />
            <div hidden={workspace !== "approach"}>
              <ApproachPicker shots={all} />
            </div>
            <div hidden={workspace !== "shots"}>
              <div className="explorer-grid" id="shot-visualization">
                <section className="panel plot-panel">
                  <SegmentedControl
                    className="chart-view-tabs"
                    fullWidth
                    size="md"
                    aria-label="Chart view"
                    value={prefs.view}
                    onChange={(v) =>
                      updatePrefs({ view: v as Preferences["view"] })
                    }
                    data={[
                      { label: "Stats chart", value: "dispersion" },
                      { label: "Overhead", value: "overhead" },
                      { label: "Distances", value: "distance" },
                      { label: "Trends", value: "trends" },
                      { label: "Rankings", value: "rankings" },
                    ]}
                  />
                  <div
                    className="selection-shortcuts"
                    aria-label="Current shot selection"
                  >
                    <Button
                      className="selection-shortcut"
                      size="xs"
                      variant="default"
                      aria-label="Change shot filters"
                      aria-expanded={selectionPanels.includes("filters")}
                      aria-controls="shot-filters"
                      title={filterExpression(filters)}
                      onClick={() => revealSelection("filters")}
                    >
                      <span className="shortcut-label">Filters</span>
                      <span className="shortcut-value">{filterSummary}</span>
                      <span aria-hidden="true">↓</span>
                    </Button>
                    <Button
                      className="selection-shortcut"
                      size="xs"
                      variant="default"
                      aria-label="Change selected dates"
                      aria-expanded={selectionPanels.includes("dates")}
                      aria-controls="shot-dates"
                      title={dateSummary}
                      onClick={() => revealSelection("dates")}
                    >
                      <span className="shortcut-label">Dates</span>
                      <span className="shortcut-value">{dateSummary}</span>
                      <span aria-hidden="true">↓</span>
                    </Button>
                  </div>
                  <div className="plot-controls chart-options">
                    {prefs.view !== "trends" && prefs.view !== "rankings" && (
                      <div className="control-field">
                        <span className="control-label">Distance</span>
                        <SegmentedControl
                          size="xs"
                          aria-label="Distance metric"
                          value={prefs.metric}
                          onChange={(v) => updatePrefs({ metric: v as Metric })}
                          data={[
                            { label: "Carry", value: "carry" },
                            { label: "Total", value: "total" },
                          ]}
                        />
                      </div>
                    )}
                    <Select
                      label="Color by"
                      size="xs"
                      value={prefs.colorBy}
                      data={dimensions.map((d) => ({
                        value: d.field,
                        label: d.label,
                      }))}
                      onChange={(v) =>
                        v && updatePrefs({ colorBy: v as Dimension })
                      }
                    />
                    {(prefs.view === "dispersion" ||
                      prefs.view === "overhead") && (
                      <>
                        <Checkbox
                          className="control-checkbox"
                          radius="xs"
                          size="xs"
                          label="Combine selection"
                          checked={prefs.dispersionMode === "combined"}
                          onChange={(e) =>
                            updatePrefs({
                              dispersionMode: e.currentTarget.checked
                                ? "combined"
                                : "separate",
                            })
                          }
                        />
                        <Select
                          label="Observed ellipse"
                          size="xs"
                          value={prefs.coverage}
                          onChange={(v) => v && updatePrefs({ coverage: v })}
                          data={[
                            { value: "0.8", label: "80% of shots" },
                            { value: "0.5", label: "50% of shots" },
                            { value: "0", label: "Off" },
                          ]}
                        />
                      </>
                    )}
                    <div className="control-field">
                      <span className="control-label">Units</span>
                      <SegmentedControl
                        size="xs"
                        aria-label="Distance units"
                        value={prefs.unit}
                        onChange={(v) => updatePrefs({ unit: v as Unit })}
                        data={["yd", "m"]}
                      />
                    </div>
                  </div>
                  {prefs.view !== "trends" && (
                    <Playback controller={playback} />
                  )}
                  {prefs.view === "rankings" ? (
                    <Rankings
                      shots={matched}
                      all={all}
                      unit={prefs.unit}
                      lateral={prefs.metric}
                      onLateralChange={(metric) => updatePrefs({ metric })}
                      colorBy={prefs.colorBy}
                    />
                  ) : prefs.view === "trends" ? (
                    <Trends
                      shots={filtered}
                      playbackDate={playbackDate}
                      onPlaybackDatesChange={updateTrendDates}
                      playbackControl={<Playback controller={playback} />}
                      combine={prefs.trendCombine}
                      onCombineChange={(trendCombine) =>
                        updatePrefs({ trendCombine })
                      }
                      separateGroups={prefs.separateTrendGroups}
                      onSeparateGroupsChange={(separateTrendGroups) =>
                        updatePrefs({ separateTrendGroups })
                      }
                      all={all}
                      unit={prefs.unit}
                      lateral={prefs.metric}
                      onLateralChange={(metric) => updatePrefs({ metric })}
                      colorBy={prefs.colorBy}
                      onSelect={setSelected}
                    />
                  ) : (
                    <>
                      <div className="availability">
                        <strong>{plotted.length} shots shown</strong>
                        {usable.length > measured.length && (
                          <span>
                            {usable.length - measured.length} without{" "}
                            {prefs.metric} distance
                          </span>
                        )}
                        {prefs.view !== "distance" &&
                          measured.length > paired.length && (
                            <span>
                              {measured.length - paired.length} without{" "}
                              {prefs.metric === "carry"
                                ? "landing"
                                : "finishing"}{" "}
                              left/right data
                            </span>
                          )}
                        {matched.length > usable.length && (
                          <span>
                            {matched.length - usable.length} flagged, omitted
                            from statistics
                          </span>
                        )}
                        {prefs.view === "overhead" && (
                          <span
                            className="geometry-note"
                            title="Overhead position unavailable or sideways offset larger than distance."
                            style={{
                              visibility:
                                paired.length > plotted.length
                                  ? "visible"
                                  : "hidden",
                            }}
                          >
                            {paired.length - plotted.length} without overhead
                            position
                          </span>
                        )}
                      </div>
                      <p className="muted small">
                        {prefs.view === "overhead"
                          ? "Flat-ground positions. Rings show distance from you. Dotted edges show a 40 yd fairway reference (20 yd each side)."
                          : prefs.view === "dispersion"
                            ? "Reported distance vs. sideways miss. This is a statistics chart, not a map."
                            : "Reported distances grouped by physical club."}
                      </p>
                      {plotted.length ? (
                        <ShotChart
                          shots={matched}
                          all={all}
                          metric={prefs.metric}
                          unit={prefs.unit}
                          colorBy={prefs.colorBy}
                          coverage={Number(prefs.coverage)}
                          dispersionMode={prefs.dispersionMode}
                          view={prefs.view}
                          selected={selected}
                          onSelect={setSelected}
                        />
                      ) : (
                        <div className="chart-empty">
                          <h3>
                            {matched.length
                              ? "No positions available for this selection."
                              : "No shots match this view."}
                          </h3>
                          <p>
                            {matched.length
                              ? "Switch to Distances to see shots without left/right data."
                              : "Change a tag or clear the date selection."}
                          </p>
                          {matched.length > 0 && (
                            <Button
                              variant="light"
                              onClick={() => updatePrefs({ view: "distance" })}
                            >
                              Show distances
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="legend" aria-label="Shot colors">
                        {[
                          ...new Set(
                            plotted
                              .slice()
                              .sort(compareClubs)
                              .map((s) => s[prefs.colorBy]),
                          ),
                        ].map((v) => (
                          <span key={v}>
                            <i
                              style={{
                                background: color(
                                  v,
                                  all.map((row) => row[prefs.colorBy]),
                                ),
                              }}
                            />
                            {prefs.colorBy === "club_id"
                              ? `${all.find((s) => s.club_id === v)!.club_label} · ${all.find((s) => s.club_id === v)!.set_id}`
                              : v}
                          </span>
                        ))}
                      </div>
                      <p className="chart-note">
                        Observed shots, not a prediction.{" "}
                        <button
                          className="text-button"
                          onClick={() => setDetails(true)}
                        >
                          About this chart
                        </button>
                      </p>
                    </>
                  )}
                </section>
                <aside className="panel inspector">
                  <div className="section-top inspector-heading">
                    <h2>Shot details</h2>
                    <Button
                      variant="default"
                      size="xs"
                      disabled={!chosen}
                      onClick={() => setSelected("")}
                      aria-label="Clear inspected shot"
                    >
                      Clear
                    </Button>
                  </div>
                  <Select
                    label="Inspect a shot"
                    searchable
                    placeholder="Choose a shot"
                    value={chosen ? selected : null}
                    data={matched.map((s) => ({
                      value: shotKey(s),
                      label: `${s.club_label} · ${s.set_id} · ${s.shot_id}`,
                    }))}
                    onChange={(v) => setSelected(v ?? "")}
                  />
                  {chosen ? (
                    <ShotDetails shot={chosen} unit={prefs.unit} />
                  ) : (
                    <p className="inspector-empty muted small">
                      Tap a dot or choose a shot to see details.
                    </p>
                  )}
                </aside>
              </div>
              <Accordion
                className="selection-panels"
                multiple
                variant="separated"
                value={selectionPanels}
                onChange={setSelectionPanels}
                transitionDuration={0}
              >
                <Accordion.Item value="filters" id="shot-filters">
                  <Accordion.Control>
                    <span className="selection-panel-heading">
                      <span className="selection-panel-title">Filters</span>
                      <span
                        className="selection-panel-summary"
                        title={filterExpression(filters)}
                      >
                        {filterSummary}
                      </span>
                      <span className="selection-panel-count">
                        {filtered.length} matched
                      </span>
                    </span>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {import.meta.env.MODE === "showcase" && (
                      <p className="showcase-note">
                        <strong>Synthetic showcase</strong> · Generated from my
                        private performance summaries. Shots and dates are
                        invented.
                      </p>
                    )}
                    <div className="filters">
                      <div className="section-top selection-actions">
                        <Button
                          variant="default"
                          size="xs"
                          onClick={backToChart}
                        >
                          Back to chart ↑
                        </Button>
                        <Group gap="sm">
                          <Button
                            variant="default"
                            size="xs"
                            onClick={() => setFilters({ ...filters, tags: [] })}
                          >
                            Clear tags
                          </Button>
                          <Button
                            variant="default"
                            size="xs"
                            onClick={saveView}
                          >
                            Save filters
                          </Button>
                          <Button
                            variant="light"
                            size="xs"
                            disabled={!savedView}
                            onClick={() => savedView && setFilters(savedView)}
                          >
                            Restore filters
                          </Button>
                        </Group>
                      </div>
                      <div className="tag-groups">
                        {dimensions.map(({ field, label }) => (
                          <fieldset className="tag-group" key={field}>
                            <legend>{label}</legend>
                            <div className="tag-options">
                              {[...new Set(all.map((s) => s[field]))]
                                .sort((a, b) =>
                                  field === "club_label"
                                    ? clubOrder(a) - clubOrder(b) ||
                                      a.localeCompare(b)
                                    : field === "club_id"
                                      ? compareClubs(
                                          all.find((s) => s.club_id === a)!,
                                          all.find((s) => s.club_id === b)!,
                                        )
                                      : a.localeCompare(b),
                                )
                                .map((value) => {
                                  const active = filters.tags.some(
                                    (t) =>
                                      t.field === field && t.value === value,
                                  );
                                  const label =
                                    field === "club_id"
                                      ? `${all.find((s) => s.club_id === value)!.club_label} · ${all.find((s) => s.club_id === value)!.set_id}`
                                      : value;
                                  return (
                                    <Button
                                      key={value}
                                      size="compact-sm"
                                      variant={active ? "light" : "outline"}
                                      color="teal"
                                      aria-pressed={active}
                                      onClick={() =>
                                        setFilters({
                                          ...filters,
                                          tags: active
                                            ? filters.tags.filter(
                                                (t) =>
                                                  !(
                                                    t.field === field &&
                                                    t.value === value
                                                  ),
                                              )
                                            : [
                                                ...filters.tags,
                                                { field, value },
                                              ],
                                        })
                                      }
                                    >
                                      {label}
                                    </Button>
                                  );
                                })}
                            </div>
                          </fieldset>
                        ))}
                      </div>
                      <div className="filter-bottom">
                        <SegmentedControl
                          size="xs"
                          aria-label="Tag matching mode"
                          value={filters.mode}
                          onChange={(v) =>
                            setFilters({
                              ...filters,
                              mode: v as Filters["mode"],
                            })
                          }
                          data={[
                            { label: "Grouped", value: "grouped" },
                            { label: "All · AND", value: "all" },
                            { label: "Any · OR", value: "any" },
                          ]}
                        />
                        <span className="expression">
                          {filterExpression(filters)}
                        </span>
                        <strong>{filtered.length} matched</strong>
                      </div>
                      <p className="muted small">
                        Grouped: OR within each field, AND between fields. Dates
                        always narrow the result.
                      </p>
                    </div>
                  </Accordion.Panel>
                </Accordion.Item>
                <Accordion.Item value="dates" id="shot-dates">
                  <Accordion.Control>
                    <span className="selection-panel-heading">
                      <span className="selection-panel-title">Dates</span>
                      <span
                        className="selection-panel-summary"
                        title={dateSummary}
                      >
                        {dateSummary}
                      </span>
                    </span>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {import.meta.env.MODE === "showcase" && (
                      <p className="showcase-note">
                        <strong>Synthetic showcase</strong> · Generated from my
                        private performance summaries. Shots and dates are
                        invented.
                      </p>
                    )}
                    <Timeline
                      shots={all}
                      filters={filters}
                      onChange={setFilters}
                      embedded
                      onBackToChart={backToChart}
                    />
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
              <section className="panel">
                <div className="section-top">
                  <div>
                    <h2>Club summaries</h2>
                  </div>
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => setDetails(true)}
                  >
                    How to read this
                  </Button>
                </div>
                <p className="muted small">
                  Unweighted usable shots · {prefs.metric} in {prefs.unit} ·
                  separate clubs and settings
                </p>
                <div className="summary-grid">
                  {grouped.map(([key, rows], i) => {
                    const values = rows
                        .map((s) => distance(s, prefs.metric, prefs.unit))
                        .filter((n): n is number => n !== null),
                      sides = rows
                        .map((s) =>
                          distance(s, prefs.metric, prefs.unit) !== null
                            ? side(s, prefs.metric, prefs.unit)
                            : null,
                        )
                        .filter((n): n is number => n !== null);
                    const contour = ellipse(
                      rows
                        .filter(
                          (s) =>
                            distance(s, prefs.metric, prefs.unit) !== null &&
                            side(s, prefs.metric, prefs.unit) !== null,
                        )
                        .map((s) => [
                          side(s, prefs.metric, prefs.unit)!,
                          distance(s, prefs.metric, prefs.unit)!,
                        ]),
                      Number(prefs.coverage) || 0.8,
                    );
                    const s = rows[0];
                    return (
                      <article
                        className="club-card"
                        key={key}
                        style={{
                          borderTopColor: color(
                            s[prefs.colorBy],
                            all.map((row) => row[prefs.colorBy]),
                          ),
                        }}
                      >
                        <div className="club-card-heading">
                          <h3>{s.club_label}</h3>
                          <Badge variant="light" color={setColor(s.set_id)}>
                            {s.set_id}
                          </Badge>
                        </div>
                        <p className="muted small">
                          {s.source} · {values.length} measured / {rows.length}{" "}
                          shots · {new Set(rows.map(sessionKey)).size}{" "}
                          {new Set(rows.map(sessionKey)).size === 1
                            ? "session"
                            : "sessions"}
                        </p>
                        <div className="median">
                          {format(quantile(values, 0.5))}
                          <small>{prefs.unit} median</small>
                        </div>
                        <dl>
                          <div>
                            <dt>Middle 80%</dt>
                            <dd>
                              {format(quantile(values, 0.1))} –{" "}
                              {format(quantile(values, 0.9))}
                            </dd>
                          </div>
                          <div>
                            <dt>Mean</dt>
                            <dd>
                              {format(
                                values.length
                                  ? values.reduce((a, b) => a + b, 0) /
                                      values.length
                                  : null,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>Min / max</dt>
                            <dd>
                              {values.length
                                ? `${format(Math.min(...values))} / ${format(Math.max(...values))}`
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>Median side</dt>
                            <dd>
                              {format(quantile(sides, 0.5))}{" "}
                              <small>({sides.length} paired)</small>
                            </dd>
                          </div>
                        </dl>
                        <details>
                          <summary>Measurement context · group {i + 1}</summary>
                          {Number(prefs.coverage) > 0 && (
                            <p>
                              {contour
                                ? `Observed ellipse: ${contour.enclosed} of ${contour.n} paired shots enclosed.`
                                : "Observed ellipse unavailable: fewer than 10 pairs or singular covariance."}
                            </p>
                          )}
                          <Context shot={s} />
                        </details>
                      </article>
                    );
                  })}
                </div>
                {!grouped.length && (
                  <p className="muted">No usable shots in this selection.</p>
                )}
              </section>
              <section className="panel">
                <div className="section-top">
                  <div>
                    <h2>
                      Shot table <span className="count">{matched.length}</span>
                    </h2>
                  </div>
                  <Group gap="sm">
                    <Button
                      size="xs"
                      variant="default"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="small pagination-status">
                      {page + 1} / {Math.max(1, Math.ceil(matched.length / 20))}
                    </span>
                    <Button
                      size="xs"
                      variant="default"
                      disabled={(page + 1) * 20 >= matched.length}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </Group>
                </div>
                <Table.ScrollContainer minWidth={680}>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        {[
                          "Shot",
                          "Club / set",
                          "Source",
                          "Session date",
                          `Carry (${prefs.unit})`,
                          `Total (${prefs.unit})`,
                          `Left/right (${prefs.unit})`,
                          `Quality`,
                        ].map((h) => (
                          <Table.Th key={h}>{h}</Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {matched.slice(page * 20, page * 20 + 20).map((s) => (
                        <Table.Tr
                          key={shotKey(s)}
                          data-selected={selected === shotKey(s)}
                        >
                          <Table.Td>
                            <button
                              className="shot-link"
                              onClick={() => setSelected(shotKey(s))}
                            >
                              {s.shot_id}
                            </button>
                          </Table.Td>
                          <Table.Td>
                            {s.club_label}
                            <small className="block muted">{s.set_id}</small>
                          </Table.Td>
                          <Table.Td>{s.source}</Table.Td>
                          <Table.Td>{s.session_date ?? "Unknown"}</Table.Td>
                          <Table.Td>
                            {format(distance(s, "carry", prefs.unit))}
                          </Table.Td>
                          <Table.Td>
                            {format(distance(s, "total", prefs.unit))}
                          </Table.Td>
                          <Table.Td>
                            {format(side(s, prefs.metric, prefs.unit))}
                          </Table.Td>
                          <Table.Td>{s.quality}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </section>
            </div>
          </>
        )}
        <footer>
          <span>Club Picker</span>
          <span>
            {showcase
              ? "Synthetic shots. No account. No uploads."
              : "Local data. No account. No uploads."}
          </span>
        </footer>
      </main>
      <Modal
        opened={settings}
        onClose={() => setSettings(false)}
        title={showcase ? "About this demo" : "Data settings"}
      >
        {showcase ? (
          <>
            <p>
              Explore invented shots generated from summary statistics of my own
              practice data. Dates and sessions are invented too; any trends
              here are examples, not my actual practice history.
            </p>
            <p>
              Try the filters, play through dates, or enter a distance in the
              Approach picker. Results describe these example shots, not a
              validated prediction of your game.
            </p>
            <p className="muted small">
              This demo does not accept personal files. Display preferences and
              saved filters stay in this browser. Reset clears only those demo
              settings, leaving any local-app backups untouched.
            </p>
            <Group>
              <Button
                variant="default"
                onClick={() => {
                  try {
                    localStorage.removeItem(preferencesKey);
                    localStorage.removeItem(savedViewKey);
                  } catch {
                    // Reset the current view even if browser storage is blocked.
                  }
                  window.location.reload();
                }}
              >
                Reset demo
              </Button>
              <Button
                component="a"
                href="https://github.com/emmatyy19/club-picker"
                target="_blank"
                rel="noreferrer"
              >
                View project
              </Button>
            </Group>
          </>
        ) : (
          <>
            <p>
              Add source files to <code>data/raw/trackman/</code> or{" "}
              <code>data/raw/toptracer/</code>, one folder per session. Confirm
              the club set when the session is processed.
            </p>
            <p>
              The reviewed repo library loads on opening. Refresh data reads it
              again and keeps your filters. Raw files still need extraction and
              review.
            </p>
            <h3>Browser backup</h3>
            <p className="muted small">
              Optional JSON transfer or recovery. Restore replaces the browser
              copy only. Refreshing or reopening uses the repo library when
              available. Backups include private session dates, but exclude
              original files and filters.
            </p>
            <Group>
              <FileButton
                onChange={(file) => {
                  setSettings(false);
                  void startImport(file);
                }}
                accept="application/json,.json"
              >
                {(props) => (
                  <Button {...props} variant="default">
                    Restore backup
                  </Button>
                )}
              </FileButton>
              <Button
                disabled={!library}
                onClick={() => library && download(library)}
              >
                Export backup
              </Button>
            </Group>
          </>
        )}
      </Modal>
      <Modal
        opened={!!pending}
        onClose={() => setPending(null)}
        title="Review this library"
        size="lg"
      >
        <p>
          {pending?.shots.length} unique shots. Importing replaces the current
          browser library; export a backup first if you want to keep it.
        </p>
        <p className="muted small">
          Confirm the physical club set for every session. A provider is not a
          club set. Club IDs must already identify the correct physical clubs.
        </p>
        {[
          ...new Map(
            pending?.shots.map((s) => [sessionKey(s), s]) ?? [],
          ).entries(),
        ].map(([key, s]) => (
          <TextInput
            key={key}
            label={`${s.source} · ${s.session_date ?? "Undated"} · ${s.session_id}`}
            value={setNames[key] ?? ""}
            onChange={(e) => {
              setSetNames({ ...setNames, [key]: e.target.value });
              setConfirmed(false);
            }}
            mb="sm"
          />
        ))}
        <Checkbox
          label="I confirm these session-to-set assignments and want to load this snapshot."
          checked={confirmed}
          onChange={(e) => setConfirmed(e.currentTarget.checked)}
          my="lg"
        />
        <Group justify="end">
          <Button variant="default" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button disabled={!confirmed} onClick={finishImport}>
            Load library
          </Button>
        </Group>
      </Modal>
      <Modal
        opened={details}
        onClose={() => setDetails(false)}
        title="Chart and statistics"
      >
        <p>
          Median is the middle shot distance. The middle 80% runs from the 10th
          to the 90th percentile using linear interpolation. Min and max include
          genuine mishits.
        </p>
        <p>
          Dispersion ellipses follow the sample covariance orientation, then
          expand to include at least the selected share of observed paired
          shots, including ties. They describe this sample, not future
          confidence or a worst-case boundary.
        </p>
        <p>
          Carry uses left/right position at landing. Total uses left/right
          position after roll. Missing values never become zero. Separate groups
          draws one ellipse per physical club and measurement context, including
          source, intent, normalization, compensation, basis, and session
          settings. Dot colors follow the Color by setting; ellipse labels
          identify each group.
        </p>
        <p>
          Combined selection calculates one ellipse from all plotted shots,
          across clubs, sets, and measurement contexts. Each shot counts
          equally, so larger sessions contribute more. This describes the
          selected mixture, rather than one interchangeable club or measurement
          setup. Filters still apply; physical club identities and club
          summaries stay separate.
        </p>
        <p>
          Stats chart uses the reported distance and left/right offset. The
          vertical axis is not forward distance along the target line, so this
          is not an exact overhead map: 200 yards with 20 yards right appears at
          (20, 200). On a flat overhead map, a confirmed radial distance of 200
          would instead be about 199 yards forward, with curved rings marking
          equal distance from the starting point. Ellipses need at least 10
          positions and a nonsingular covariance matrix.
        </p>
        <p>
          Overhead uses equal axis scales and recalculates ellipses from
          converted positions. It shows flat-ground endpoints, not flight paths
          or course terrain. Toptracer totals use the radial geometry supported
          by the reviewed screenshots. Its final offline cannot locate the carry
          endpoint. Tables and summaries retain reported distances.
        </p>
      </Modal>
    </div>
  );
}
function ShotDetails({ shot: s, unit }: { shot: Shot; unit: Unit }) {
  return (
    <div className="shot-details">
      <h3>
        {s.club_label}{" "}
        <Badge variant="light" color={setColor(s.set_id)}>
          {s.set_id}
        </Badge>
      </h3>
      <p className="muted small">
        {s.source} · {s.session_date ?? "Date unknown"}
      </p>
      <dl>
        {(["carry", "total"] as Metric[]).map((m) => (
          <div key={m}>
            <dt>{m === "carry" ? "Carry" : "Total"}</dt>
            <dd>
              {format(distance(s, m, unit))} {unit}
              <small className="block muted">
                {m === "carry" ? "Landing" : "Finishing"} left/right{" "}
                {format(side(s, m, unit))} {unit}
              </small>
            </dd>
          </div>
        ))}
        {trendMetrics
          .filter(
            (m) => !["carry", "total", "side", "spread"].includes(m.value),
          )
          .map((m) => {
            const value = trendValue(s, m.value, unit, "total");
            return value === null ? null : (
              <div key={m.value}>
                <dt>{m.label}</dt>
                <dd>
                  {format(value)} {trendUnit(m.value, unit)}
                </dd>
              </div>
            );
          })}
      </dl>
      {s.quality !== "usable" && (
        <Alert color="orange">
          {s.quality}: {s.exclusion_reason}
        </Alert>
      )}
      <details className="measurement-details">
        <summary>Measurement details</summary>
        <Context shot={s} />
        <dl className="context shot-identities">
          <div>
            <dt>Physical club</dt>
            <dd>{s.club_id}</dd>
          </div>
          <div>
            <dt>Shot ID</dt>
            <dd>{s.shot_id}</dd>
          </div>
          <div>
            <dt>Original units</dt>
            <dd>{s.source_unit}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
