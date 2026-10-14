import { z } from "zod";
const text = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^[^\x00-\x1f]*$/);
const value = z.number().finite();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
  });
export const shotSchema = z
  .strictObject({
    session_id: text,
    shot_id: text,
    club_id: text,
    club_label: text,
    set_id: text,
    source: z.enum(["trackman", "toptracer", "manual"]),
    source_unit: z.enum(["yd", "m"]),
    session_date: date.nullable(),
    carry_m: value.nonnegative(),
    carry_side_m: value.nullable(),
    total_m: value.nonnegative().nullable(),
    total_side_m: value.nullable(),
    intent: z.enum(["full", "partial", "punch", "experiment", "unknown"]),
    normalization: z.enum(["normalized", "unadjusted", "unknown"]),
    compensation: z.enum(["on", "off", "unknown"]),
    carry_basis: z.enum(["measured", "modeled", "unknown"]),
    total_basis: z.enum(["measured", "modeled", "unknown"]),
    quality: z.enum(["usable", "suspected_error", "excluded"]),
    exclusion_reason: z.string().max(1000),
    session_mode: text,
    normalization_settings: text,
    ball_type: text,
    surface: text,
    ball_speed_mps: value.nonnegative().nullable().optional(),
    spin_rpm: value.nonnegative().nullable().optional(),
    launch_deg: value.min(-90).max(90).nullable().optional(),
    apex_m: value.nonnegative().nullable().optional(),
    landing_deg: value.min(-90).max(90).nullable().optional(),
    hang_time_s: value.nonnegative().nullable().optional(),
    curve_m: value.nullable().optional(),
  })
  .refine(
    (s) => s.total_side_m === null || s.total_m !== null,
    "Total side requires total distance",
  )
  .refine(
    (s) =>
      s.quality === "usable"
        ? s.exclusion_reason === ""
        : s.exclusion_reason.trim().length > 0,
    "Quality and exclusion reason disagree",
  );
export const snapshotSchema = z.strictObject({
  kind: z.literal("club-picker-explorer"),
  version: z.literal(1),
  distance_unit: z.literal("m"),
  shots: z.array(shotSchema).max(100000),
});
export type Shot = z.infer<typeof shotSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Metric = "carry" | "total";
export type Unit = "yd" | "m";
export type Dimension = "club_label" | "source" | "set_id" | "club_id";
export type Tag = { field: Dimension; value: string };
export type Filters = {
  tags: Tag[];
  mode: "grouped" | "all" | "any";
  start: string;
  end: string;
  session: string;
  undated: boolean;
};
export const emptyFilters: Filters = {
  tags: [],
  mode: "grouped",
  start: "",
  end: "",
  session: "",
  undated: false,
};
export const sessionKey = (s: Shot) => JSON.stringify([s.source, s.session_id]);
export const shotKey = (s: Shot) =>
  JSON.stringify([
    s.source,
    s.session_id,
    s.shot_id,
    s.normalization,
    s.compensation,
  ]);
export const groupKey = (s: Shot, metric: Metric) =>
  JSON.stringify([
    s.club_id,
    s.source,
    s.intent,
    s.normalization,
    s.compensation,
    s[`${metric}_basis`],
    s.session_mode,
    s.normalization_settings,
    s.ball_type,
    s.surface,
  ]);
export function parseSnapshot(input: unknown): Snapshot {
  const parsed = snapshotSchema.parse(input);
  const seen = new Map<string, Shot>();
  const clubs = new Map<string, string>();
  const sessions = new Map<string, string>();
  for (const s of parsed.shots) {
    const club = JSON.stringify([s.set_id, s.club_label]);
    if (clubs.has(s.club_id) && clubs.get(s.club_id) !== club)
      throw Error("A physical club has conflicting labels or sets.");
    clubs.set(s.club_id, club);
    const session = JSON.stringify([s.session_date, s.set_id]);
    if (sessions.has(sessionKey(s)) && sessions.get(sessionKey(s)) !== session)
      throw Error("A session has conflicting dates or sets.");
    sessions.set(sessionKey(s), session);
    const key = shotKey(s);
    const prior = seen.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(s))
      throw Error(
        "Conflicting measurements for the same shot. Review the source snapshot.",
      );
    seen.set(key, s);
  }
  return { ...parsed, shots: [...seen.values()] };
}
export function filterShots(shots: Shot[], f: Filters): Shot[] {
  return shots.filter((s) => {
    if (f.session && sessionKey(s) !== f.session) return false;
    if (f.undated && s.session_date !== null) return false;
    if (
      (f.start || f.end) &&
      (!s.session_date ||
        (f.start && s.session_date < f.start) ||
        (f.end && s.session_date > f.end))
    )
      return false;
    if (!f.tags.length) return true;
    const matches = (t: Tag) => s[t.field] === t.value;
    if (f.mode === "any") return f.tags.some(matches);
    if (f.mode === "all") return f.tags.every(matches);
    return [...new Set(f.tags.map((t) => t.field))].every((field) =>
      f.tags.filter((t) => t.field === field).some(matches),
    );
  });
}
export const distance = (s: Shot, m: Metric, u: Unit) =>
  s[`${m}_m`] === null ? null : s[`${m}_m`]! / (u === "yd" ? 0.9144 : 1);
export const side = (s: Shot, m: Metric, u: Unit) =>
  s[`${m}_side_m`] === null
    ? null
    : s[`${m}_side_m`]! / (u === "yd" ? 0.9144 : 1);
export function quantile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo);
}
/** Conventional bag order, independent of measured distance or provider. */
export function clubOrder(label: string): number {
  const name = label.toLowerCase().replace(/[-_]/g, " ").trim();
  if (/^(driver|dr|1\s*w(ood)?)$/.test(name)) return 0;
  const numbered = name.match(/^(\d+)\s*(wood|w|hybrid|h|iron|i)$/);
  if (numbered) {
    const family = numbered[2];
    return (
      (/^(wood|w)$/.test(family) ? 10 : /^(hybrid|h)$/.test(family) ? 30 : 50) +
      Number(numbered[1])
    );
  }
  const wedge = name.match(/^(\d{2})(?:\s*(?:°|deg(?:ree)?s?|wedge|w))*$/);
  if (wedge && Number(wedge[1]) >= 40 && Number(wedge[1]) <= 72)
    return 70 + Number(wedge[1]);
  const wedges: Record<string, number> = {
    pw: 46,
    "pitching wedge": 46,
    gw: 50,
    "gap wedge": 50,
    aw: 52,
    "approach wedge": 52,
    uw: 52,
    "utility wedge": 52,
    sw: 56,
    "sand wedge": 56,
    lw: 60,
    "lob wedge": 60,
  };
  if (name in wedges) return 70 + wedges[name];
  if (/^(putter|pt)$/.test(name)) return 200;
  return 300;
}
export function compareClubs(a: Shot, b: Shot): number {
  return (
    clubOrder(a.club_label) - clubOrder(b.club_label) ||
    a.club_label.localeCompare(b.club_label) ||
    a.set_id.localeCompare(b.set_id) ||
    a.club_id.localeCompare(b.club_id)
  );
}
export function plottedShots(
  shots: Shot[],
  metric: Metric,
  view: "dispersion" | "distance" | "overhead",
): Shot[] {
  return shots.filter(
    (s) =>
      s.quality === "usable" &&
      s[`${metric}_m`] !== null &&
      (view === "distance" || s[`${metric}_side_m`] !== null) &&
      (view !== "overhead" || overheadPoint(s, metric, "m") !== null),
  );
}
// Trackman documents radial distance on flat ground. The reviewed Toptracer
// Total Distance screenshots support the same endpoint conversion. Carry is
// not promoted by that total-only evidence, even if carry-side is supplied.
export function overheadPoint(
  shot: Shot,
  metric: Metric,
  unit: Unit,
): [number, number] | null {
  if (
    shot.source !== "trackman" &&
    !(shot.source === "toptracer" && metric === "total")
  )
    return null;
  const r = distance(shot, metric, unit),
    x = side(shot, metric, unit);
  if (r === null || x === null || r < 0 || Math.abs(x) > r) return null;
  return [x, Math.sqrt(r * r - x * x)];
}
export function overheadBounds(
  width: number,
  height: number,
  maxX: number,
  maxY: number,
) {
  const y = Math.max(maxY, (2 * maxX * height) / width);
  return { x: (y * width) / height / 2, y };
}
export function setColor(id: string): string {
  return id === "set-a" ? "#347d6a" : id === "set-b" ? "#9875a4" : color(id);
}
export function groups(shots: Shot[], metric: Metric) {
  const map = new Map<string, Shot[]>();
  for (const s of shots.filter((s) => s.quality === "usable")) {
    const k = groupKey(s, metric);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return [...map.entries()].sort((a, b) => compareClubs(a[1][0], b[1][0]));
}
export function ellipse(
  points: [number, number][],
  coverage: number,
): { points: [number, number][]; enclosed: number; n: number } | null {
  if (points.length < 10) return null;
  const n = points.length,
    mx = points.reduce((a, p) => a + p[0], 0) / n,
    my = points.reduce((a, p) => a + p[1], 0) / n;
  const xx = points.reduce((a, p) => a + (p[0] - mx) ** 2, 0) / (n - 1),
    yy = points.reduce((a, p) => a + (p[1] - my) ** 2, 0) / (n - 1),
    xy = points.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / (n - 1);
  const det = xx * yy - xy * xy;
  if (det <= 1e-12 * Math.max(1, xx * yy)) return null;
  const ds = points
    .map(
      ([x, y]) =>
        (yy * (x - mx) ** 2 -
          2 * xy * (x - mx) * (y - my) +
          xx * (y - my) ** 2) /
        det,
    )
    .sort((a, b) => a - b);
  const q = ds[Math.ceil(coverage * n) - 1],
    theta = 0.5 * Math.atan2(2 * xy, xx - yy),
    disc = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy);
  const a = Math.sqrt((q * (xx + yy + disc)) / 2),
    b = Math.sqrt(q * Math.max(0, (xx + yy - disc) / 2));
  return {
    n,
    enclosed: ds.filter((d) => d <= q + 1e-9).length,
    points: Array.from({ length: 97 }, (_, i) => {
      const t = (i / 96) * 2 * Math.PI;
      return [
        mx +
          a * Math.cos(t) * Math.cos(theta) -
          b * Math.sin(t) * Math.sin(theta),
        my +
          a * Math.cos(t) * Math.sin(theta) +
          b * Math.sin(t) * Math.cos(theta),
      ];
    }),
  };
}
export const palette = [
  "#347d6a",
  "#bd7046",
  "#627fb3",
  "#9875a4",
  "#a3943f",
  "#5a929c",
  "#b65e79",
  "#637563",
];
export function color(value: string, domain?: string[]) {
  if (value === "set-a" || value === "set-b") return setColor(value);
  if (domain) {
    const index = [...new Set(domain)].sort().indexOf(value);
    return palette[index] ?? `hsl(${(index * 137.508) % 360} 38% 43%)`;
  }
  let hash = 0;
  for (const c of value) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
export const format = (n: number | null) => (n === null ? "—" : n.toFixed(1));
export function filterExpression(f: Filters) {
  const label = (t: Tag) =>
    `${t.field === "club_label" ? "club" : t.field === "set_id" ? "set" : t.field === "club_id" ? "physical club" : "source"}: ${t.value}`;
  if (!f.tags.length) return "All clubs · all sources · all sets";
  if (f.mode !== "grouped")
    return f.tags.map(label).join(f.mode === "all" ? " AND " : " OR ");
  return [...new Set(f.tags.map((t) => t.field))]
    .map(
      (field) =>
        "(" +
        f.tags
          .filter((t) => t.field === field)
          .map(label)
          .join(" OR ") +
        ")",
    )
    .join(" AND ");
}
