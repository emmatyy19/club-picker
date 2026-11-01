import { chartTheme } from "./design/chartTheme";
import { ChartTouchControl } from "./ChartTouchControl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fullView,
  panViewport,
  pinchViewport,
  zoomViewport,
  type Viewport,
} from "./navigation";
import * as echarts from "echarts/core";
import type { ScatterSeriesOption, LineSeriesOption } from "echarts/charts";
import { ScatterChart, LineChart } from "echarts/charts";
import {
  GraphicComponent,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  color,
  compareClubs,
  plottedShots,
  overheadPoint,
  overheadBounds,
  distance,
  shotKey,
  side,
  type Dimension,
  type Metric,
  type Shot,
  type Unit,
} from "./data";
import { dispersionContours, type DispersionMode } from "./dispersion";
echarts.use([
  ScatterChart,
  LineChart,
  GraphicComponent,
  GridComponent,
  TooltipComponent,
  MarkLineComponent,
  CanvasRenderer,
]);
export function ShotChart({
  shots,
  all,
  metric,
  unit,
  colorBy,
  coverage,
  dispersionMode,
  view,
  selected,
  onSelect,
}: {
  shots: Shot[];
  all: Shot[];
  metric: Metric;
  unit: Unit;
  colorBy: Dimension;
  coverage: number;
  dispersionMode: DispersionMode;
  view: "dispersion" | "distance" | "overhead";
  selected: string;
  onSelect: (key: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const navigation = useRef<Viewport>({ ...fullView });
  const navigationKey = useRef("");
  const controls = useRef<(action: "in" | "out" | "reset") => void>(() => {});
  const [zoom, setZoom] = useState(1);
  const [touchExploring, setTouchExploring] = useState(false);
  const touchEnabled = useRef(false);
  touchEnabled.current = touchExploring;
  useEffect(() => setTouchExploring(false), [view]);
  const contours = useMemo(
    () =>
      dispersionContours({
        shots,
        metric,
        unit,
        view,
        coverage,
        mode: dispersionMode,
      }),
    [shots, metric, unit, view, coverage, dispersionMode],
  );
  const contourColor = (rows: Shot[]) =>
    dispersionMode === "combined"
      ? "#345d4b"
      : color(
          rows[0][colorBy],
          all.map((s) => s[colorBy]),
        );
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const key = `${view}/${metric}/${unit}`;
    if (navigationKey.current !== key) {
      navigation.current = { ...fullView };
      navigationKey.current = key;
    }
    let dragged = false;
    // Hidden workspaces/accordions have no size yet. ResizeObserver supplies
    // the visible dimensions when they open.
    const chart = echarts.init(element, undefined, {
      width: element.clientWidth || 1,
      height: element.clientHeight || 1,
    });
    const eligible = plottedShots(shots, metric, view);
    const point = (s: Shot): [number, number] =>
      view === "overhead"
        ? overheadPoint(s, metric, unit)!
        : [side(s, metric, unit)!, distance(s, metric, unit)!];
    const labels = [
      ...new Map(
        eligible
          .slice()
          .sort(compareClubs)
          .map((s) => [s.club_id, s]),
      ).keys(),
    ];
    const values = all
      .map((s) => distance(s, metric, unit))
      .filter((v): v is number => v !== null);
    const sides = all
      .map((s) => side(s, metric, unit))
      .filter((v): v is number => v !== null);
    const maxY = Math.max(50, ...values) * 1.12,
      maxX = Math.ceil((Math.max(20, ...sides.map(Math.abs)) * 1.2) / 10) * 10;
    const series: (ScatterSeriesOption | LineSeriesOption)[] = [];
    for (const contour of contours) {
      series.push({
        type: "line",
        name: `${contour.label} · ${contour.shape.enclosed}/${contour.shape.n} observed shots`,
        data: contour.shape.points,
        symbol: "none",
        silent: true,
        lineStyle: {
          color: contourColor(contour.rows),
          type: contour.dash,
          width: dispersionMode === "combined" ? 2 : 1.5,
          opacity: 0.75,
        },
        id: contour.key,
      });
    }
    series.push({
      type: "scatter",
      name: "Shots",
      symbolSize: (_value, params) =>
        shotKey(eligible[params.dataIndex]) === selected ? 15 : 8,
      data: eligible.map((s) => ({
        value:
          view === "distance"
            ? [labels.indexOf(s.club_id), distance(s, metric, unit)]
            : point(s),
        itemStyle: {
          color: color(
            s[colorBy],
            all.map((s) => s[colorBy]),
          ),
          opacity: shotKey(s) === selected ? 1 : 0.75,
          borderColor: "#fffdf7",
          borderWidth: 1,
        },
      })),
      markLine:
        view !== "distance"
          ? {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: { color: "#bdc9c3", type: "dashed" },
              data: [
                { xAxis: 0 },
                ...(view === "overhead"
                  ? [-20, 20].map((yards) => ({
                      xAxis: yards * (unit === "yd" ? 1 : 0.9144),
                      lineStyle: {
                        color: "#8ca394",
                        type: "dotted" as const,
                        opacity: 0.5,
                        width: 1.5,
                      },
                    }))
                  : []),
              ],
            }
          : undefined,
    });
    const draw = () => {
      const plotWidth = Math.max(1, chart.getWidth() - 79);
      const plotHeight = Math.max(1, chart.getHeight() - 60);
      const bounds = overheadBounds(
        plotWidth,
        plotHeight,
        maxX,
        Math.ceil(maxY / 10) * 10,
      );
      const nav = navigation.current;
      setZoom(1 / nav.scale);
      const baseX = view === "overhead" ? bounds.x : maxX;
      const baseY = view === "overhead" ? bounds.y : Math.ceil(maxY / 10) * 10;
      const xMin = -baseX + 2 * baseX * (nav.x - nav.scale / 2);
      const xMax = xMin + 2 * baseX * nav.scale;
      const yMin = baseY * (nav.y - nav.scale / 2);
      const yMax = yMin + baseY * nav.scale;
      const rings: LineSeriesOption[] = [];
      const ringLabels: object[] = [];
      if (view === "overhead") {
        const step = 50;
        for (let r = step; r <= bounds.y; r += step) {
          rings.push({
            type: "line",
            silent: true,
            symbol: "none",
            z: 0,
            name: `${r} ${unit} from start`,
            data: Array.from({ length: 181 }, (_, i) => {
              const angle = (i * Math.PI) / 180;
              return [r * Math.cos(angle), r * Math.sin(angle)];
            }),
            lineStyle: { color: "#c9d5cc", type: "dashed", width: 1 },
            endLabel: { show: false },
          });
          if (r >= yMin && r <= yMax && xMin <= 0 && xMax >= 0)
            ringLabels.push({
              type: "text",
              silent: true,
              z: 10,
              left: 55 + (plotWidth * (0 - xMin)) / (xMax - xMin) + 8,
              top: 20 + plotHeight * (1 - (r - yMin) / (yMax - yMin)) - 12,
              style: {
                text: `${r} ${unit}`,
                fill: "#617068",
                fontSize: 10,
                backgroundColor: "#ffffffdd",
                padding: 2,
              },
            });
        }
      }
      chart.setOption(
        {
          ...chartTheme,
          animation: false,
          grid: { left: 55, right: 24, top: 20, bottom: 40 },
          tooltip: {
            trigger: "item",
            renderMode: "richText",
            formatter: (raw: unknown) => {
              const p = raw as { seriesType: string; dataIndex: number };
              if (p.seriesType !== "scatter") return "";
              const s = eligible[p.dataIndex];
              const forward =
                view === "overhead"
                  ? `\nforward: ${point(s)[1].toFixed(1)} ${unit}`
                  : "";
              return `${s.club_label} · ${s.set_id}\n${s.shot_id}\n${metric}: ${distance(s, metric, unit)?.toFixed(1)} ${unit}\nside: ${side(s, metric, unit)?.toFixed(1) ?? "unknown"} ${unit}${forward}`;
            },
          },
          xAxis:
            view !== "distance"
              ? {
                  type: "value",
                  min: xMin,
                  max: xMax,
                  axisLabel: {
                    showMinLabel: false,
                    showMaxLabel: false,
                    formatter: (v: number) => String(Math.round(v * 10) / 10),
                  },
                  name: "",
                  nameLocation: "middle",
                  nameGap: 35,
                  splitLine: { lineStyle: { color: "#e5e6db" } },
                }
              : {
                  type: "category",
                  data: labels.map((id) => {
                    const s = all.find((s) => s.club_id === id)!;
                    return `${s.club_label}\n${s.set_id}`;
                  }),
                  axisLabel: {
                    interval: "auto",
                    hideOverlap: true,
                    fontSize: 10,
                  },
                  splitLine: { show: false },
                },
          yAxis: {
            type: "value",
            min: yMin,
            max: yMax,
            name: "",
            nameTextStyle: { align: "left" },
            splitLine: { lineStyle: { color: "#e5e6db" } },
            axisLabel: {
              color: "#718078",
              showMinLabel: false,
              showMaxLabel: false,
              formatter: (v: number) => String(Math.round(v * 10) / 10),
            },
          },
          series: [...rings, ...series],
          graphic: view === "overhead" ? ringLabels : [],
        },
        { notMerge: true },
      );
    };
    draw();
    controls.current = (action) => {
      navigation.current =
        action === "reset"
          ? { ...fullView }
          : zoomViewport(navigation.current, action === "in" ? 0.75 : 1 / 0.75);
      draw();
    };
    let drag: { x: number; y: number; initial: Viewport } | null = null;
    const inside = (e: { clientX: number; clientY: number }) => {
      const r = element.getBoundingClientRect();
      return (
        e.clientX >= r.left + 55 &&
        e.clientX <= r.right - 24 &&
        e.clientY >= r.top + 20 &&
        e.clientY <= r.bottom - 40
      );
    };
    const wheel = (e: WheelEvent) => {
      if (!inside(e)) return;
      e.preventDefault();
      const r = element.getBoundingClientRect();
      navigation.current = zoomViewport(
        navigation.current,
        Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * 0.003),
        (e.clientX - r.left - 55) / (r.width - 79),
        1 - (e.clientY - r.top - 20) / (r.height - 60),
      );
      draw();
    };
    const fingers = new Map<number, { clientX: number; clientY: number }>();
    let pinch: {
      initial: Viewport;
      midpoint: [number, number];
      span: number;
    } | null = null;
    const fingerPosition = () => {
      const points = [...fingers.values()].slice(0, 2);
      const a = points[0],
        b = points[1] ?? a;
      const r = element.getBoundingClientRect();
      return {
        midpoint: [
          ((a.clientX + b.clientX) / 2 - r.left - 55) /
            Math.max(1, r.width - 79),
          1 -
            ((a.clientY + b.clientY) / 2 - r.top - 20) /
              Math.max(1, r.height - 60),
        ] as [number, number],
        span: Math.max(
          1,
          Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        ),
      };
    };
    const rebaseTouch = () => {
      pinch = fingers.size
        ? { initial: { ...navigation.current }, ...fingerPosition() }
        : null;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        if (!touchEnabled.current) {
          dragged = false;
          return;
        }
        if (!inside(e)) return;
        e.preventDefault();
        element.setPointerCapture(e.pointerId);
        fingers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        dragged = true; // Touch exploration never also opens a shot drawer.
        rebaseTouch();
        return;
      }
      if (!inside(e) || e.button !== 0) return;
      dragged = false;
      drag = { x: e.clientX, y: e.clientY, initial: { ...navigation.current } };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        if (!touchEnabled.current) {
          fingers.clear();
          pinch = null;
          return;
        }
        if (!fingers.has(e.pointerId) || !pinch) return;
        e.preventDefault();
        fingers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
        const current = fingerPosition();
        navigation.current = pinchViewport(
          pinch.initial,
          pinch.span / current.span,
          pinch.midpoint,
          current.midpoint,
          view === "distance",
        );
        draw();
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) < 4 && !dragged) return;
      if (!dragged) element.setPointerCapture(e.pointerId);
      dragged = true;
      navigation.current = panViewport(
        drag.initial,
        view === "distance" ? 0 : -dx / (chart.getWidth() - 79),
        dy / (chart.getHeight() - 60),
      );
      draw();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        fingers.delete(e.pointerId);
        if (element.hasPointerCapture(e.pointerId))
          element.releasePointerCapture(e.pointerId);
        rebaseTouch();
        return;
      }
      drag = null;
    };
    const touchMove = (e: TouchEvent) => {
      if (touchEnabled.current && fingers.size) e.preventDefault();
    };
    const keyboard = (e: KeyboardEvent) => {
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-0.1, 0],
        ArrowRight: [0.1, 0],
        ArrowUp: [0, 0.1],
        ArrowDown: [0, -0.1],
      };
      if (directions[e.key]) {
        e.preventDefault();
        const [x, y] = directions[e.key];
        navigation.current = panViewport(
          navigation.current,
          view === "distance" ? 0 : x,
          y,
        );
        draw();
      }
    };
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("lostpointercapture", up);
    element.addEventListener("touchmove", touchMove, { passive: false });
    element.addEventListener("keydown", keyboard);
    chart.on("click", (p) => {
      if (
        !touchEnabled.current &&
        !dragged &&
        p.seriesType === "scatter" &&
        eligible[p.dataIndex]
      )
        onSelect(shotKey(eligible[p.dataIndex]));
    });
    const observer = new ResizeObserver(() => {
      chart.resize({
        width: element?.clientWidth || 1,
        height: element?.clientHeight || 1,
      });
      draw();
    });
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("lostpointercapture", up);
      element.removeEventListener("touchmove", touchMove);
      element.removeEventListener("keydown", keyboard);
      chart.dispose();
    };
  }, [
    shots,
    all,
    metric,
    unit,
    colorBy,
    contours,
    dispersionMode,
    view,
    selected,
    onSelect,
  ]);
  return (
    <>
      <div className="chart-navigation">
        <button onClick={() => controls.current("in")} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => controls.current("out")} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => controls.current("reset")}>Reset view</button>
        <span className="chart-zoom">{zoom.toFixed(1)}×</span>
        <ChartTouchControl
          active={touchExploring}
          onChange={setTouchExploring}
        />
      </div>
      <div
        ref={host}
        tabIndex={0}
        className={`shot-chart chart-touch-surface${touchExploring ? " touch-exploring" : ""}`}
        style={{ touchAction: touchExploring ? "none" : "pan-y pinch-zoom" }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setTouchExploring(false);
        }}
        role="img"
        aria-label={`${metric} ${view} chart. Select a shot using the table below for keyboard access.`}
      />
      {contours.length > 0 && (
        <div className="dispersion-legend" aria-label="Dispersion ellipses">
          {contours.map((c) => (
            <span key={c.key} title={c.context}>
              <i
                style={{
                  borderTopColor: contourColor(c.rows),
                  borderTopStyle: c.dash,
                }}
              />
              <span>
                {c.label} · {c.shape.enclosed}/{c.shape.n} shots
                {dispersionMode === "combined" &&
                  ` · ${c.groupCount} measurement ${c.groupCount === 1 ? "group" : "groups"}`}
              </span>
            </span>
          ))}
        </div>
      )}
      {view !== "distance" && coverage > 0 && contours.length === 0 && (
        <p className="chart-note">
          No ellipse available: needs 10 paired shots and spread in both
          directions.
        </p>
      )}
    </>
  );
}
