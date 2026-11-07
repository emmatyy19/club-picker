import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@mantine/core";
import * as echarts from "echarts/core";
import { ScatterChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  dateMeasurements,
  eligibleDates,
  practiceContext,
  summarizeDates,
} from "./insights";
import { distance, format, shotKey, type Shot, type Unit } from "./data";

export function recencyColor(index: number, count: number): string {
  const fraction = count > 1 ? index / (count - 1) : 1;
  const start = [196, 214, 181];
  const end = [52, 93, 75];
  return `rgb(${start.map((v, i) => Math.round(v + (end[i] - v) * fraction)).join(", ")})`;
}

echarts.use([ScatterChart, GridComponent, CanvasRenderer]);
export function consistencyDates(shots: Shot[], unit: Unit) {
  return [
    ...eligibleDates(dateMeasurements(shots, "carry", unit, "carry")),
  ].map(([date, values]) => ({
    date,
    ...summarizeDates(new Map([[date, values]])),
  }));
}
export function ConsistencyView({
  shots,
  unit,
  combined,
  onSelect,
  playbackDate,
}: {
  playbackDate: string | null;
  shots: Shot[];
  unit: Unit;
  combined: boolean;
  onSelect: (key: string) => void;
}) {
  const [context, setContext] = useState("");
  const [chosenDate, setChosenDate] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const groups = [
    ...new Map(shots.map((s) => [practiceContext(s), s])).entries(),
  ];
  const key = groups.some(([k]) => k === context) ? context : groups[0]?.[0];
  const rows = useMemo(
    () => (combined ? shots : shots.filter((s) => practiceContext(s) === key)),
    [shots, combined, key],
  );
  const dates = useMemo(() => consistencyDates(rows, unit), [rows, unit]);
  const active =
    playbackDate !== null
      ? dates.find((d) => d.date === playbackDate)
      : (dates.find((d) => d.date === chosenDate) ?? dates.at(-1));
  const datedShots = rows.filter(
    (s) => s.quality === "usable" && s.session_date === active?.date,
  );
  const omitted = new Set(
    rows
      .filter(
        (s) =>
          s.quality === "usable" &&
          s.session_date &&
          !dates.some((d) => d.date === s.session_date),
      )
      .map((s) => s.session_date),
  ).size;
  useEffect(() => {
    if (!host.current || !dates.length) return;
    const chart = echarts.init(host.current);
    chart.setOption({
      animation: false,
      grid: { left: 58, right: 24, top: 28, bottom: 64 },
      xAxis: {
        type: "value",
        scale: true,
        name: `Typical carry (${unit}) →`,
        nameLocation: "middle",
        nameGap: 36,
        axisLabel: { color: "#657266" },
        splitLine: { lineStyle: { color: "#e0e5d7" } },
      },
      yAxis: {
        type: "value",
        min: 0,
        name: `Carry spread (${unit})`,
        nameTextStyle: { color: "#657266" },
        axisLabel: { color: "#657266" },
        splitLine: { lineStyle: { color: "#e0e5d7" } },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 20,
          data: dates.map((d, i) => ({
            value: [d.median, d.spread],
            date: d.date,
            symbolSize: d.date === active?.date ? 25 : 18,
            itemStyle: {
              color: recencyColor(i, dates.length),
              borderColor: d.date === active?.date ? "#244b3c" : "#fffdf7",
              borderWidth: d.date === active?.date ? 3 : 2,
              opacity: 1,
            },
          })),
        },
      ],
    });
    chart.on("click", (p) => {
      const date = (p.data as { date?: string })?.date;
      if (date && playbackDate === null) setChosenDate(date);
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [dates, unit, active?.date, playbackDate]);
  return (
    <section className="consistency-view">
      {!combined && groups.length > 1 && (
        <Select
          label="Measurement group"
          value={key}
          onChange={(v) => v && setContext(v)}
          data={groups.map(([k, s], i) => ({
            value: k,
            label: `${s.source} · ${s.normalization}${groups.filter(([, r]) => r.source === s.source && r.normalization === s.normalization).length > 1 ? ` · ${i + 1}` : ""}`,
          }))}
        />
      )}
      <p className="practice-guide">
        Right: longer carry · Lower: tighter carry range. Each dot is a practice
        date.
        {combined &&
          " Combined selection: changes can reflect the mix of clubs or sources."}
      </p>
      {dates.length ? (
        <>
          <div
            className="consistency-recency"
            aria-label="Dot shading: older to newer dates"
          >
            <span>Older</span>
            <i aria-hidden="true" />
            <span>Newer</span>
            <span>Ring: selected date</span>
          </div>
          <div
            ref={host}
            className="consistency-chart"
            role="img"
            aria-label="Typical carry against middle 80% carry spread. Use the date selector below to inspect points."
          />
          <div className="consistency-details">
            <Select
              label="Inspect a practice date"
              value={active?.date ?? null}
              disabled={playbackDate !== null}
              placeholder="No eligible shots on this date"
              onChange={(v) => v && setChosenDate(v)}
              data={dates.map((d) => ({
                value: d.date,
                label: `${d.date}${d.date === dates.at(-1)?.date ? " · latest" : ""}`,
              }))}
            />
            <div className="consistency-metrics">
              <span>
                Typical carry
                <strong>
                  {active ? format(active.median) : "—"} {unit}
                </strong>
              </span>
              <span>
                80% width
                <strong>
                  {active ? format(active.spread) : "—"} {unit}
                </strong>
              </span>
              <span>
                Shots<strong>{active?.shots ?? 0}</strong>
              </span>
            </div>
            <details>
              <summary>Shots from this date</summary>
              <div className="consistency-shots">
                {datedShots.map((s, i) => (
                  <button key={shotKey(s)} onClick={() => onSelect(shotKey(s))}>
                    {s.club_label} · #{i + 1}
                    <strong>
                      {format(distance(s, "carry", unit))} {unit}
                    </strong>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </>
      ) : (
        <p className="practice-empty">
          Choose a club with at least 5 usable shots on a dated session.
        </p>
      )}
      <p className="practice-guide">
        Spread is the distance between the 10th and 90th percentiles, including
        mishits. This measures distance consistency, not sideways accuracy.
        {omitted > 0 && ` ${omitted} dates with fewer than 5 shots omitted.`}
      </p>
    </section>
  );
}
