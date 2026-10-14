import {
  distance,
  ellipse,
  groups,
  overheadPoint,
  plottedShots,
  side,
  type Metric,
  type Shot,
  type Unit,
} from "./data";

export type DispersionMode = "separate" | "combined";

/** Describe the displayed sample without changing physical club identities. */
export function dispersionContours({
  shots,
  metric,
  unit,
  view,
  coverage,
  mode,
}: {
  shots: Shot[];
  metric: Metric;
  unit: Unit;
  view: "dispersion" | "overhead" | "distance";
  coverage: number;
  mode: DispersionMode;
}) {
  if (view === "distance" || coverage <= 0) return [];
  const eligible = plottedShots(shots, metric, view);
  const separate = groups(eligible, metric);
  const bins: [string, Shot[]][] =
    mode === "combined" ? [["combined", eligible]] : separate;
  const names = separate.map(
    ([, rows]) =>
      `${rows[0].club_label} · ${rows[0].set_id} · ${rows[0].source}`,
  );
  return bins.flatMap(([key, rows], i) => {
    const shape = ellipse(
      rows.map((s): [number, number] =>
        view === "overhead"
          ? overheadPoint(s, metric, unit)!
          : [side(s, metric, unit)!, distance(s, metric, unit)!],
      ),
      coverage,
    );
    if (!shape) return [];
    const name = mode === "combined" ? "Combined selection" : names[i];
    const label =
      mode === "separate" && names.filter((n) => n === name).length > 1
        ? `${name} · context ${names.slice(0, i + 1).filter((n) => n === name).length}`
        : name;
    return [
      {
        key,
        rows,
        shape,
        label,
        groupCount: separate.length,
        // A dash distinguishes contexts even when they share the same dot color.
        dash: (mode === "combined"
          ? "solid"
          : ["solid", "dashed", "dotted"][i % 3]) as
          "solid" | "dashed" | "dotted",
        context:
          mode === "combined"
            ? `${separate.length} measurement groups pooled. Each shot counts equally.`
            : `Intent: ${rows[0].intent}; normalization: ${rows[0].normalization}; compensation: ${rows[0].compensation}; basis: ${rows[0][`${metric}_basis`]}; mode: ${rows[0].session_mode}; settings: ${rows[0].normalization_settings}; ball: ${rows[0].ball_type}; surface: ${rows[0].surface}`,
      },
    ];
  });
}
