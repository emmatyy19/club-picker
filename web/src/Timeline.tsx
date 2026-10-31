import { chartTheme, dateSliderStyle } from "./design/chartTheme";
import { Button, Group, TextInput } from "@mantine/core";
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { ScatterChart } from "echarts/charts";
import {
  GridComponent,
  DataZoomComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { color, sessionKey, type Filters, type Shot } from "./data";
import { SessionBrowser } from "./SessionBrowser";
echarts.use([
  ScatterChart,
  GridComponent,
  DataZoomComponent,
  TooltipComponent,
  CanvasRenderer,
]);
const dayMs = 86400000;
const iso = (n: number) => new Date(n).toISOString().slice(0, 10);
export function Timeline({
  shots,
  filters,
  onChange,
  embedded = false,
  onBackToChart,
}: {
  shots: Shot[];
  filters: Filters;
  onChange: (f: Filters) => void;
  embedded?: boolean;
  onBackToChart?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const instance = useRef<ReturnType<typeof echarts.init> | null>(null);
  const sessions = [
    ...new Map(shots.map((s) => [sessionKey(s), s])).entries(),
  ].sort((a, b) =>
    (a[1].session_date ?? "").localeCompare(b[1].session_date ?? ""),
  );
  const selected = sessions.find(([key]) => key === filters.session)?.[1];
  const dated = sessions.filter(([, s]) => s.session_date !== null);
  const days = dated.map(([, s]) => Date.parse(s.session_date! + "T00:00:00Z"));
  const min = Math.min(...days),
    max = Math.max(...days, min + dayMs);
  const change = useRef(onChange);
  change.current = onChange;
  const current = useRef(filters);
  current.current = filters;
  const clear = () =>
    onChange({ ...filters, start: "", end: "", session: "", undated: false });
  useEffect(() => {
    if (!ref.current || !dated.length) return;
    // Hidden workspaces/accordions have no size yet. ResizeObserver supplies
    // the visible dimensions when they open.
    const chart = echarts.init(ref.current, undefined, {
      width: ref.current.clientWidth || 1,
      height: ref.current.clientHeight || 1,
    });
    instance.current = chart;
    const byDay = new Map<string, number>();
    const points = dated.map(([key, s]) => {
      const level = byDay.get(s.session_date!) ?? 0;
      byDay.set(s.session_date!, level + 1);
      return {
        value: [Date.parse(s.session_date! + "T00:00:00Z"), level],
        name: key,
        itemStyle: { color: color(s.source) },
      };
    });
    chart.setOption({
      ...chartTheme,
      animation: false,
      grid: { left: 24, right: 24, top: 12, bottom: 90 },
      tooltip: {
        renderMode: "richText",
        formatter: (raw: unknown) => {
          const p = raw as { dataIndex: number };
          const s = dated[p.dataIndex][1];
          return `${s.session_date} · ${s.source}\n${s.set_id}`;
        },
      },
      xAxis: {
        type: "time",
        min: min - dayMs,
        max: max + dayMs,
        axisLabel: { hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: { show: false, min: -1, max: Math.max(1, ...byDay.values()) },
      dataZoom: [
        {
          ...dateSliderStyle,
          left: 24,
          right: 24,
          startValue: current.current.start
            ? Date.parse(current.current.start + "T00:00:00Z")
            : min - dayMs,
          endValue: current.current.end
            ? Date.parse(current.current.end + "T00:00:00Z")
            : max + dayMs,
        },
      ],
      series: [{ type: "scatter", symbolSize: 12, data: points }],
    });
    chart.on("click", (p) => {
      const s = dated[p.dataIndex];
      if (s)
        change.current({
          ...current.current,
          session: current.current.session === s[0] ? "" : s[0],
          start: "",
          end: "",
          undated: false,
        });
    });
    chart.on("datazoom", () => {
      const option = chart.getOption() as {
        dataZoom: { start: number; end: number }[];
      };
      const z = option.dataZoom[0];
      const lo = min - dayMs,
        hi = max + dayMs;
      change.current({
        ...current.current,
        session: "",
        undated: false,
        start: iso(lo + ((hi - lo) * z.start) / 100),
        end: iso(lo + ((hi - lo) * z.end) / 100),
      });
    });
    const observer = new ResizeObserver(() =>
      chart.resize({
        width: ref.current?.clientWidth || 1,
        height: ref.current?.clientHeight || 1,
      }),
    );
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
      instance.current = null;
    };
    // Recreate for date-input/session changes, but not while the slider is dragging.
  }, [shots]);
  useEffect(() => {
    instance.current?.setOption({
      dataZoom: [
        {
          startValue: filters.start
            ? Date.parse(filters.start + "T00:00:00Z")
            : min - dayMs,
          endValue: filters.end
            ? Date.parse(filters.end + "T00:00:00Z")
            : max + dayMs,
        },
      ],
    });
  }, [filters.start, filters.end, min, max]);
  return (
    <section className={`timeline ${embedded ? "timeline-embedded" : "panel"}`}>
      <div className="timeline-toolbar">
        {!embedded && (
          <div>
            <h2>Session timeline</h2>
          </div>
        )}
        <div className="timeline-selection">
          <span className="muted small" role="status">
            {selected
              ? `${selected.session_date ?? "Undated"} · ${selected.source} · ${selected.set_id}`
              : filters.undated
                ? "Undated sessions"
                : filters.start || filters.end
                  ? `${filters.start || "Beginning"} to ${filters.end || "Latest"}`
                  : `All ${sessions.length} sessions`}
          </span>
          <div className="timeline-actions">
            <Button variant="default" size="xs" onClick={clear}>
              All dates
            </Button>
            {onBackToChart && (
              <Button variant="default" size="xs" onClick={onBackToChart}>
                Back to chart ↑
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="muted small">
        Tap a session. Drag the handles to select dates, or the shaded range to
        move it.
      </p>
      <div className="timeline-range-layout">
        {dated.length > 0 ? (
          <div ref={ref} className="timeline-chart" />
        ) : (
          <p className="muted">No dated sessions yet.</p>
        )}
        <Group gap="sm" align="end" className="timeline-date-inputs">
          <TextInput
            label="Start date"
            type="date"
            value={filters.start}
            max={filters.end || undefined}
            onInput={(e) =>
              onChange({
                ...filters,
                start: e.currentTarget.value,
                session: "",
                undated: false,
              })
            }
          />
          <TextInput
            label="End date"
            type="date"
            value={filters.end}
            min={filters.start || undefined}
            onInput={(e) =>
              onChange({
                ...filters,
                end: e.currentTarget.value,
                session: "",
                undated: false,
              })
            }
          />
        </Group>
      </div>

      <SessionBrowser shots={shots} filters={filters} onChange={onChange} />
    </section>
  );
}
