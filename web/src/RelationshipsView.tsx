import { useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@mantine/core";
import * as echarts from "echarts/core";
import { ScatterChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { distance, shotKey, type Shot, type Unit } from "./data";
import { practiceContext } from "./insights";
import { trendValue } from "./trends";
echarts.use([ScatterChart, GridComponent, TooltipComponent, CanvasRenderer]);
type Shading = "date" | "spin" | "launch" | "carry" | "total";
type Relationship = "efficiency" | "flight";
export function relationshipPoints(shots: Shot[], unit: Unit) {
  return shots
    .filter((s) => s.quality === "usable" && s.ball_speed_mps != null)
    .map((s) => ({
      shot: s,
      speed: trendValue(s, "ball_speed", unit, "carry")!,
      carry: distance(s, "carry", unit)!,
    }));
}
export function efficiencyPoints(shots: Shot[], unit: Unit) {
  return relationshipPoints(shots, unit)
    .filter((p) => p.shot.club_speed_mps != null && p.shot.club_speed_mps > 0)
    .map((p) => ({
      ...p,
      clubSpeed: trendValue(p.shot, "club_speed", unit, "carry")!,
      smash: trendValue(p.shot, "smash", unit, "carry")!,
    }));
}
function shadeValue(s: Shot, shading: Shading, unit: Unit): number | null {
  if (shading === "carry" || shading === "total")
    return distance(s, shading, unit);
  if (shading === "date")
    return s.session_date ? Date.parse(`${s.session_date}T00:00:00Z`) : null;
  return shading === "spin" ? (s.spin_rpm ?? null) : (s.launch_deg ?? null);
}
export function RelationshipsView({
  shots,
  unit,
  combined,
  playbackDate,
  onSelect,
}: {
  shots: Shot[];
  unit: Unit;
  combined: boolean;
  playbackDate: string | null;
  onSelect: (key: string) => void;
}) {
  const [context, setContext] = useState("");
  const [shading, setShading] = useState<Shading>("carry");
  const [relationship, setRelationship] = useState<Relationship>("efficiency");
  const [selected, setSelected] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const groups = [
    ...new Map(shots.map((s) => [practiceContext(s), s])).entries(),
  ];
  const firstPaired = shots.find(
    (s) =>
      s.quality === "usable" &&
      s.ball_speed_mps != null &&
      (relationship === "flight" ||
        (s.club_speed_mps != null && s.club_speed_mps > 0)),
  );
  const key = groups.some(([k]) => k === context)
    ? context
    : firstPaired
      ? practiceContext(firstPaired)
      : groups[0]?.[0];
  const rows = useMemo(
    () => (combined ? shots : shots.filter((s) => practiceContext(s) === key)),
    [shots, combined, key],
  );
  const points = useMemo(
    () =>
      relationship === "efficiency"
        ? efficiencyPoints(rows, unit).map((p) => ({
            ...p,
            x: p.clubSpeed,
            y: p.speed,
          }))
        : relationshipPoints(rows, unit).map((p) => ({
            ...p,
            x: p.speed,
            y: p.carry,
          })),
    [rows, unit, relationship],
  );
  const speedUnit = unit === "yd" ? "mph" : "m/s";
  const xLabel = `${relationship === "efficiency" ? "Club" : "Ball"} speed (${speedUnit})`;
  const yLabel =
    relationship === "efficiency"
      ? `Ball speed (${speedUnit})`
      : `Carry (${unit})`;
  const shades = points
    .map((p) => shadeValue(p.shot, shading, unit))
    .filter((v): v is number => v !== null);
  const low = Math.min(...shades),
    high = Math.max(...shades);
  const label = (v: number) =>
    shading === "date"
      ? new Date(v).toISOString().slice(0, 10)
      : `${v.toFixed(shading === "spin" ? 0 : 1)} ${shading === "spin" ? "rpm" : shading === "launch" ? "°" : unit}`;
  useEffect(() => {
    if (!host.current || !points.length) return;
    const chart = echarts.init(host.current);
    chart.setOption({
      animation: false,
      grid: { left: 58, right: 24, top: 32, bottom: 58 },
      xAxis: {
        type: "value",
        scale: true,
        name: xLabel,
        nameLocation: "middle",
        nameGap: 32,
        splitLine: { lineStyle: { color: "#e0e5d7" } },
      },
      yAxis: {
        type: "value",
        scale: true,
        name: yLabel,
        splitLine: { lineStyle: { color: "#e0e5d7" } },
      },
      tooltip: {
        trigger: "item",
        renderMode: "richText",
        formatter: (p: { dataIndex: number }) => {
          const row = points[p.dataIndex];
          const smash = trendValue(row.shot, "smash", unit, "carry");
          const lines = [
            row.shot.session_date ?? "Unknown date",
            `${xLabel}: ${row.x.toFixed(1)}`,
            `${yLabel}: ${row.y.toFixed(1)}`,
          ];
          if (relationship === "efficiency")
            lines.push(`Carry: ${row.carry.toFixed(1)} ${unit}`);
          if (shading === "total") {
            const total = distance(row.shot, "total", unit);
            lines.push(
              total == null
                ? "Total: unknown"
                : `Total: ${total.toFixed(1)} ${unit}`,
            );
          }
          if (smash !== null) lines.push(`Smash factor: ${smash.toFixed(2)}`);
          return lines.join("\n");
        },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 12,
          data: points.map((p) => {
            const value = shadeValue(p.shot, shading, unit);
            const fraction =
              value === null
                ? 0
                : high === low
                  ? 0.5
                  : (value - low) / (high - low);
            const active =
              playbackDate !== null
                ? p.shot.session_date === playbackDate
                : shotKey(p.shot) === selected;
            return {
              value: [p.x, p.y],
              symbolSize: active ? 17 : 12,
              itemStyle: {
                color:
                  value === null
                    ? "#afb3b0"
                    : `rgb(${[196, 214, 181].map((v, i) => Math.round(v + ([52, 93, 75][i] - v) * fraction)).join(",")})`,
                opacity: playbackDate !== null && !active ? 0.3 : 0.85,
                borderColor: active ? "#244b3c" : "#fffdf7",
                borderWidth: active ? 2 : 1,
              },
            };
          }),
        },
      ],
    });
    chart.on("click", (p) => {
      const row = points[p.dataIndex];
      if (row) {
        setSelected(shotKey(row.shot));
        onSelect(shotKey(row.shot));
      }
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [
    points,
    unit,
    shading,
    low,
    high,
    selected,
    playbackDate,
    onSelect,
    xLabel,
    yLabel,
  ]);
  return (
    <section className="relationships-view">
      {rows.some((s) => s.session_mode === "synthetic showcase") && (
        <p className="practice-guide">
          Demo club speed, ball speed, spin and launch are invented for
          illustration.
        </p>
      )}
      <div className="miss-controls">
        <Select
          label="Relationship"
          value={relationship}
          onChange={(v) => v && setRelationship(v as Relationship)}
          data={[
            { value: "efficiency", label: "Club → ball speed" },
            { value: "flight", label: "Ball speed → carry" },
          ]}
        />
        {!combined && groups.length > 1 && (
          <Select
            label="Measurement group"
            value={key}
            onChange={(v) => v && setContext(v)}
            data={groups.map(([k, s], i) => ({
              value: k,
              label: `${s.source} · ${s.normalization} · ${i + 1}`,
            }))}
          />
        )}
        <Select
          label="Color by"
          value={shading}
          onChange={(v) => v && setShading(v as Shading)}
          data={[
            { value: "carry", label: "Carry" },
            { value: "total", label: "Total" },
            { value: "date", label: "Practice date" },
            { value: "spin", label: "Spin rate" },
            { value: "launch", label: "Launch angle" },
          ]}
        />
      </div>
      <p className="practice-guide">
        {relationship === "efficiency"
          ? "At similar club speeds, which shots produce more ball speed and distance? Smash factor is ball speed ÷ club speed; compare within the same club and conditions."
          : "At similar ball speeds, how much does your carry vary? Select a shot to inspect its launch, spin and height."}
        {combined &&
          " Combined selection can reflect different clubs or sources."}
      </p>
      {points.length > 0 && shades.length === 0 && (
        <p className="practice-guide">
          Gray: no recorded{" "}
          {shading === "spin"
            ? "spin"
            : shading === "launch"
              ? "launch angle"
              : shading === "date"
                ? "date"
                : shading}
          .
        </p>
      )}
      {shades.length > 0 && (
        <div className="consistency-recency">
          <span>{label(low)}</span>
          <i aria-hidden="true" />
          <span>{label(high)}</span>
          {shades.length < points.length && <span>Gray: unknown</span>}
        </div>
      )}
      {points.length ? (
        <>
          <div
            ref={host}
            className="consistency-chart"
            role="img"
            aria-label={`${xLabel} versus ${yLabel}. Use Inspect a shot below for keyboard or phone selection.`}
          />
          <Select
            label="Inspect a shot"
            placeholder="Choose a shot"
            value={
              points.some((p) => shotKey(p.shot) === selected) ? selected : null
            }
            onChange={(v) => {
              setSelected(v);
              if (v) onSelect(v);
            }}
            data={points.map((p, i) => ({
              value: shotKey(p.shot),
              label: `${p.shot.session_date ?? "Unknown date"} · #${i + 1} · ${p.carry.toFixed(1)} ${unit}`,
            }))}
          />
        </>
      ) : (
        <p className="practice-empty">
          {relationship === "efficiency"
            ? "No paired club and ball speeds here. Try a Trackman group, or choose Ball speed → carry."
            : "No shots with both ball speed and carry in this selection."}
        </p>
      )}
      <p className="practice-guide">
        {points.length} paired shots ·{" "}
        {rows.filter((s) => s.quality === "usable").length - points.length}{" "}
        without the required speeds. Patterns show associations, not a swing
        diagnosis.
      </p>
    </section>
  );
}
