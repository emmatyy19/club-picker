import { ChartTools } from "./ChartTools";
import { chartTheme, dateSliderStyle } from "./design/chartTheme";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Checkbox, Select, SegmentedControl, Table } from "@mantine/core";
import * as echarts from "echarts/core";
import { CustomChart, ScatterChart } from "echarts/charts";
import type { CustomSeriesOption, ScatterSeriesOption } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  color,
  compareClubs,
  format,
  shotKey,
  type Metric,
  type Shot,
  type Unit,
} from "./data";
import {
  sessionTrends,
  trendContext,
  trendMetrics,
  trendUnit,
  trendValue,
  type SessionTrend,
  type TrendMetric,
} from "./trends";
echarts.use([
  CustomChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
]);
export function Trends({
  shots,
  all,
  unit,
  lateral,
  onLateralChange,
  colorBy,
  onSelect,
  combine,
  onCombineChange,
  separateGroups,
  onSeparateGroupsChange,
  playbackDate,
  settings,
  unitsControl,
  playbackControl,
  onPlaybackDatesChange,
}: {
  combine: boolean;
  onCombineChange: (combine: boolean) => void;
  separateGroups: boolean;
  onSeparateGroupsChange: (separate: boolean) => void;
  playbackDate: string | null;
  settings: ReactNode;
  unitsControl: ReactNode;
  playbackControl: ReactNode;
  onPlaybackDatesChange: (dates: string[]) => void;
  shots: Shot[];
  all: Shot[];
  unit: Unit;
  lateral: Metric;
  onLateralChange: (metric: Metric) => void;
  colorBy: "club_id" | "club_label" | "source" | "set_id";
  onSelect: (key: string) => void;
}) {
  const [metric, setMetric] = useState<TrendMetric>("carry");
  const [club, setClub] = useState("");
  const [individual, setIndividual] = useState(false);
  const clubs = [
    ...new Map(
      shots
        .slice()
        .sort(compareClubs)
        .map((s) => [s.club_id, s]),
    ).values(),
  ];
  const best = clubs
    .slice()
    .sort(
      (a, b) =>
        shots.filter((s) => s.club_id === b.club_id).length -
        shots.filter((s) => s.club_id === a.club_id).length,
    )[0];
  const chosenClub = clubs.some((s) => s.club_id === club)
    ? club
    : best?.club_id;
  const selected = useMemo(
    () => (combine ? shots : shots.filter((s) => s.club_id === chosenClub)),
    [combine, shots, chosenClub],
  );
  const contexts = [
    ...new Map(
      selected
        .filter((s) => s.quality === "usable")
        .map((s) => [trendContext(s, metric, lateral), s]),
    ).entries(),
  ];
  const mode = combine || !separateGroups ? "combined" : "separate";
  const domainSessions = useMemo(
    () => sessionTrends(selected, metric, unit, lateral, mode),
    [selected, metric, unit, lateral, mode],
  );
  useEffect(
    () =>
      onPlaybackDatesChange([...new Set(domainSessions.map((s) => s.date))]),
    [domainSessions, onPlaybackDatesChange],
  );
  const sessions =
    playbackDate === null
      ? domainSessions
      : domainSessions.filter((s) => s.date <= playbackDate);
  const styles = Object.fromEntries(
    [...new Set(domainSessions.map((s) => s.context))].map((key, i) => {
      const row = domainSessions.find((s) => s.context === key)!.shots[0].shot;
      const label =
        mode === "combined"
          ? combine
            ? "Combined selection"
            : `${row.club_label} · ${row.set_id} · combined groups`
          : `${row.club_label} · ${row.set_id} · ${row.source}`;
      return [
        key,
        {
          label,
          color:
            mode === "combined"
              ? "#345d4b"
              : color(
                  row[colorBy],
                  all.map((s) => s[colorBy]),
                ),
          symbol: ["circle", "diamond", "triangle", "rect"][i % 4],
        },
      ];
    }),
  );
  const suffix = trendUnit(metric, unit);
  const count = sessions.reduce((n, s) => n + s.n, 0);
  const usable = selected.filter(
    (s) =>
      s.quality === "usable" &&
      (playbackDate === null ||
        (s.session_date !== null && s.session_date <= playbackDate)),
  );
  const unknownDate = usable.filter(
    (s) =>
      s.session_date === null && trendValue(s, metric, unit, lateral) !== null,
  ).length;
  const unknownValue = usable.filter(
    (s) => trendValue(s, metric, unit, lateral) === null,
  ).length;
  const small =
    metric === "spread"
      ? sessionTrends(selected, "side", unit, lateral, mode).filter(
          (s) => s.n < 2 && (playbackDate === null || s.date <= playbackDate),
        ).length
      : 0;
  return (
    <>
      <ChartTools playback={playbackControl}>
        {settings}
        <div className="settings-checkboxes">
          <Checkbox
            radius="xs"
            size="xs"
            label="Individual shots"
            checked={individual}
            disabled={metric === "spread"}
            onChange={(e) => setIndividual(e.currentTarget.checked)}
          />
          <Checkbox
            className="measurement-group-toggle"
            radius="xs"
            size="xs"
            label="Separate measurement groups"
            disabled={combine || contexts.length < 2}
            checked={separateGroups}
            onChange={(e) => onSeparateGroupsChange(e.currentTarget.checked)}
          />
        </div>
        <details className="measurement-explanation">
          <summary>About measurement groups</summary>
          <p>
            Normalization adjusts reported results to standard conditions, so
            adjusted and unadjusted measurements can differ. Unknown means the
            setting was not recorded. Separate groups keeps each setup apart;
            combining describes your selected mixture.
          </p>
          {contexts.map(([key, row], i) => (
            <p key={key}>
              {i + 1}. {row.club_label} · {row.set_id} · {row.source}:
              normalization {row.normalization}; {row.normalization_settings};
              compensation {row.compensation}.
            </p>
          ))}
        </details>
      </ChartTools>
      <div className="plot-controls trend-controls">
        {unitsControl}
        <Select
          size="xs"
          label="Trend metric"
          value={metric}
          data={[...trendMetrics]}
          onChange={(v) => v && setMetric(v as TrendMetric)}
        />
        <Select
          size="xs"
          label="Physical club"
          searchable
          disabled={combine}
          placeholder="All selected clubs"
          value={combine ? null : (chosenClub ?? null)}
          data={clubs.map((s) => ({
            value: s.club_id,
            label: `${s.club_label} · ${s.set_id}`,
          }))}
          onChange={(v) => setClub(v ?? "")}
        />
        <Checkbox
          className="control-checkbox"
          radius="xs"
          size="xs"
          label="Combine selection"
          checked={combine}
          onChange={(e) => onCombineChange(e.currentTarget.checked)}
        />
        {["side", "spread"].includes(metric) && (
          <div className="control-field">
            <span className="control-label">Left/right at</span>
            <SegmentedControl
              size="xs"
              disabled={!["side", "spread"].includes(metric)}
              aria-label="Left/right position"
              value={lateral}
              onChange={(v) => onLateralChange(v as Metric)}
              data={[
                { value: "carry", label: "Landing" },
                { value: "total", label: "Finishing" },
              ]}
            />
          </div>
        )}
      </div>
      <div className="availability trend-availability">
        <strong>
          {count} measured shots · {sessions.length}{" "}
          {mode === "combined"
            ? sessions.length === 1
              ? "date"
              : "dates"
            : sessions.length === 1
              ? "session group"
              : "session groups"}
        </strong>
        {unknownValue > 0 && (
          <span>{unknownValue} missing this measurement</span>
        )}
        {unknownDate > 0 && <span>{unknownDate} without a date</span>}
        {small > 0 && (
          <span>{small} session with fewer than 2 measurements</span>
        )}
      </div>
      <p className="muted small">
        {metric === "spread"
          ? `${mode === "combined" ? "Daily" : "Session"} P90 − P10 ${lateral === "carry" ? "landing" : "finishing"} left/right width. Lower means a narrower spread.`
          : `${mode === "combined" ? "Daily" : "Session"} median and middle 80% of measured shots${metric === "side" ? ` · ${lateral === "carry" ? "landing" : "finishing"} left/right` : ""}.`}
        {["side", "curve"].includes(metric) &&
          " Below zero is left; above zero is right."}
      </p>
      {sessions.length ? (
        <TrendChart
          sessions={sessions}
          domainSessions={domainSessions}
          styles={styles}
          all={all}
          colorBy={colorBy}
          playbackDate={playbackDate}
          metric={metric}
          suffix={suffix}
          individual={individual}
          onSelect={onSelect}
        />
      ) : (
        <div className="chart-empty">
          <h3>No dated measurements for this selection.</h3>
          <p>Choose another metric or adjust your selection.</p>
        </div>
      )}
      {sessions.length > 0 && (
        <div className="legend trend-legend">
          {Object.entries(styles)
            .filter(([key]) => sessions.some((s) => s.context === key))
            .map(([key, style]) => (
              <span key={key}>
                <i
                  data-symbol={style.symbol}
                  style={{ background: style.color }}
                />
                {style.label}
              </span>
            ))}
        </div>
      )}
      {individual && metric !== "spread" && sessions.length > 0 && (
        <div className="legend trend-legend">
          <strong>Shots</strong>
          {[
            ...new Map(
              sessions
                .flatMap((s) => s.shots.map((p) => p.shot))
                .sort(compareClubs)
                .map((row) => [row[colorBy], row]),
            ).entries(),
          ].map(([value, row]) => (
            <span key={value}>
              <i
                style={{
                  background: color(
                    value,
                    all.map((s) => s[colorBy]),
                  ),
                }}
              />
              {colorBy === "club_id"
                ? `${row.club_label} · ${row.set_id}`
                : value}
            </span>
          ))}
        </div>
      )}
      {sessions.length === 1 && (
        <p className="muted small">
          One date shows a snapshot, not a change over time.
        </p>
      )}
      <details className="inline-help">
        <summary>About this trend</summary>
        <p className="chart-note">
          Observed sessions. Ranges describe these shots, not uncertainty about
          your next shot. Gaps have no estimated values.
        </p>
        {mode === "combined" && (
          <p className="chart-note">
            Each shot counts equally. Changing clubs or sources can change the
            combined trend.
          </p>
        )}
      </details>
      {sessions.length > 0 && (
        <details>
          <summary>Session values</summary>
          <Table.ScrollContainer minWidth={420}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  {mode === "separate" && <Table.Th>Group</Table.Th>}
                  <Table.Th>Shots</Table.Th>
                  <Table.Th>
                    {metric === "spread" ? "Width" : "Median"} ({suffix})
                  </Table.Th>
                  {metric !== "spread" && <Table.Th>Middle 80%</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sessions.map((s) => (
                  <Table.Tr key={s.session}>
                    <Table.Td>{s.date}</Table.Td>
                    {mode === "separate" && (
                      <Table.Td>{styles[s.context].label}</Table.Td>
                    )}
                    <Table.Td>{s.n}</Table.Td>
                    <Table.Td>{format(s.median)}</Table.Td>
                    {metric !== "spread" && (
                      <Table.Td>
                        {format(s.low)} – {format(s.high)}
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </details>
      )}
    </>
  );
}
function TrendChart({
  sessions,
  metric,
  suffix,
  domainSessions,
  styles,
  all,
  colorBy,
  playbackDate,
  individual,
  onSelect,
}: {
  sessions: SessionTrend[];
  metric: TrendMetric;
  suffix: string;
  domainSessions: SessionTrend[];
  styles: Record<string, { label: string; color: string; symbol: string }>;
  all: Shot[];
  colorBy: "club_id" | "club_label" | "source" | "set_id";
  playbackDate: string | null;
  individual: boolean;
  onSelect: (key: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    // Hidden workspaces/accordions have no size yet. ResizeObserver supplies
    // the visible dimensions when they open.
    const chart = echarts.init(host.current, undefined, {
      width: host.current.clientWidth || 1,
      height: host.current.clientHeight || 1,
    });
    const dates = sessions.map((s) => Date.parse(`${s.date}T00:00:00Z`));
    const raw = sessions.flatMap((s, i) =>
      s.shots.map((p) => ({ ...p, date: dates[i] })),
    );
    const domainDates = domainSessions.map((s) =>
      Date.parse(`${s.date}T00:00:00Z`),
    );
    const domainValues = domainSessions.flatMap((s) =>
      individual
        ? s.shots.map((p) => p.value)
        : [s.low ?? s.median, s.high ?? s.median],
    );
    const low = Math.min(
      ...domainValues,
      ...(["side", "curve"].includes(metric) ? [0] : []),
    );
    const high = Math.max(
      ...domainValues,
      ...(["side", "curve"].includes(metric) ? [0] : []),
    );
    const padding = Math.max(1, high - low) * 0.1;
    const series: (CustomSeriesOption | ScatterSeriesOption)[] = [];
    if (metric !== "spread")
      series.push({
        type: "custom",
        name: "Middle 80%",
        encode: { x: 0, y: [1, 2] },
        silent: true,
        clip: true,
        data: sessions.map((s, i) => ({
          value: [dates[i], s.low, s.high],
          itemStyle: { color: styles[s.context].color },
        })),
        renderItem: (_params, api) => {
          const low = api.coord([api.value(0), api.value(1)]),
            high = api.coord([api.value(0), api.value(2)]);
          return {
            type: "rect",
            shape: {
              x: low[0] - 6,
              y: high[1],
              width: 12,
              height: Math.max(1, low[1] - high[1]),
            },
            style: { fill: api.visual("color") as string, opacity: 0.2 },
          };
        },
      });
    if (individual && metric !== "spread")
      series.push({
        type: "scatter",
        name: "Individual shots",
        symbolSize: 4,
        data: raw.map((p) => ({
          value: [p.date, p.value],
          shot: p.shot,
          measurement: p.value,
          itemStyle: {
            color: color(
              p.shot[colorBy],
              all.map((s) => s[colorBy]),
            ),
            opacity: 0.3,
          },
        })),
      });
    series.push({
      type: "scatter",
      name: metric === "spread" ? "Session spread" : "Session median",
      symbolSize: 10,
      itemStyle: { borderColor: "#fffdf7", borderWidth: 1 },
      data: sessions.map((s, i) => ({
        value: [dates[i], s.median],
        summary: s,
        symbol: styles[s.context].symbol,
        symbolSize: s.date === playbackDate ? 15 : 10,
        itemStyle: { color: styles[s.context].color },
      })),
      markLine: ["side", "curve"].includes(metric)
        ? {
            silent: true,
            symbol: "none",
            label: { show: false },
            lineStyle: { color: "#aab7ad", type: "dashed" },
            data: [{ yAxis: 0 }],
          }
        : undefined,
    });
    chart.setOption({
      ...chartTheme,
      animation: false,
      useUTC: true,
      grid: { left: 60, right: 24, top: 35, bottom: 96 },
      xAxis: {
        type: "time",
        min: Math.min(...domainDates) - 86400000 * 7,
        max: Math.max(...domainDates) + 86400000 * 7,
        axisLabel: {
          formatter: (v: number) => new Date(v).toISOString().slice(0, 10),
          hideOverlap: true,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        min: low - padding,
        max: high + padding,
        name: `${trendMetrics.find((m) => m.value === metric)!.label} (${suffix})`,
        nameTextStyle: { align: "left" },
        axisLabel: {
          formatter: (value: number) => String(Number(value.toFixed(1))),
        },
        splitLine: { lineStyle: { color: "#e5e6db" } },
      },
      dataZoom: [
        { type: "inside", filterMode: "none" },
        {
          ...dateSliderStyle,
          left: 60,
          right: 24,
        },
      ],
      tooltip: {
        trigger: "item",
        renderMode: "richText",
        formatter: (p: unknown) => {
          const point = p as {
            data: { shot?: Shot; measurement?: number; summary?: SessionTrend };
          };
          if (point.data.shot) {
            const shot = point.data.shot;
            return `${shot.session_date}\n${shot.club_label} · ${shot.set_id} · ${shot.source}\n${shot.shot_id}\n${point.data.measurement!.toFixed(1)} ${suffix}`;
          }
          const s = point.data.summary!;
          return `${s.date}\n${styles[s.context].label}\n${s.n} measured shots\n${metric === "spread" ? "Width" : "Median"}: ${s.median.toFixed(1)} ${suffix}${s.low !== null ? `\nMiddle 80%: ${s.low.toFixed(1)} – ${s.high!.toFixed(1)} ${suffix}` : ""}`;
        },
      },
      series,
    });
    chart.on("click", (p) => {
      const data = p.data as { shot?: Shot };
      if (data.shot) onSelect(shotKey(data.shot));
    });
    const observer = new ResizeObserver(() =>
      chart.resize({
        width: host.current?.clientWidth || 1,
        height: host.current?.clientHeight || 1,
      }),
    );
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [
    sessions,
    domainSessions,
    styles,
    all,
    colorBy,
    playbackDate,
    metric,
    suffix,
    individual,
    onSelect,
  ]);
  return (
    <div
      ref={host}
      className="trend-chart"
      role="img"
      aria-label={`${trendMetrics.find((m) => m.value === metric)!.label} over session dates. Session values are available in the table below.`}
    />
  );
}
