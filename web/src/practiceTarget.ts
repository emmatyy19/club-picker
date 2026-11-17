import {
  compareClubs,
  overheadPoint,
  plottedShots,
  type Shot,
  type Unit,
  type Metric,
} from "./data";

export type TargetSize = { distance: number; width: number; depth: number }; // metres
export const initialTarget: TargetSize = {
  distance: 130 * 0.9144,
  width: 30 * 0.9144,
  depth: 20 * 0.9144,
};

export function targetBounds(size: TargetSize, unit: Unit) {
  const scale = unit === "yd" ? 0.9144 : 1;
  return {
    left: -size.width / 2 / scale,
    right: size.width / 2 / scale,
    near: (size.distance - size.depth / 2) / scale,
    far: (size.distance + size.depth / 2) / scale,
  };
}

export function targetClubs(
  shots: Shot[],
  setId: string,
  first: string,
  second: string,
) {
  const sets = [...new Set(shots.map((s) => s.set_id))].sort();
  const set = sets.includes(setId) ? setId : sets[0];
  const clubs = [
    ...new Map(
      shots.filter((s) => s.set_id === set).map((s) => [s.club_id, s]),
    ).values(),
  ].sort(compareClubs);
  const a =
    clubs.find((s) => s.club_id === first) ??
    clubs.find((s) => /^7\s*iron$/i.test(s.club_label)) ??
    clubs[0];
  const others = clubs.filter((s) => s !== a);
  const b =
    others.find((s) => s.club_id === second) ??
    others.find((s) => /^8\s*iron$/i.test(s.club_label)) ??
    others[0];
  return { sets, set, clubs, a, b };
}

export function scoreTarget(shots: Shot[], metric: Metric, size: TargetSize) {
  const plotted = plottedShots(shots, metric, "overhead");
  const { left, right, near, far } = targetBounds(size, "m");
  const hits = plotted.filter((s) => {
    const [x, y] = overheadPoint(s, metric, "m")!;
    return x >= left && x <= right && y >= near && y <= far;
  }).length;
  return {
    hits,
    plotted: plotted.length,
    dates: new Set(
      plotted.flatMap((s) => (s.session_date ? [s.session_date] : [])),
    ).size,
  };
}
