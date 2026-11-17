import { it, expect } from "vitest";
import { scoreTarget, targetBounds, targetClubs } from "../src/practiceTarget";
import { shot } from "./fixtures";
const size = { distance: 4, width: 6, depth: 0.5 };
it("scores the overhead forward coordinate, includes boundary hits and omits missing geometry", () => {
  const s = {
    ...shot,
    total_m: 5,
    total_side_m: 3,
    total_distance_geometry: "radial" as const,
  };
  expect(
    scoreTarget(
      [
        s,
        { ...s, total_side_m: -3 },
        { ...s, total_side_m: 0 },
        { ...s, total_side_m: null },
        { ...s, quality: "excluded" },
      ],
      "total",
      size,
    ),
  ).toEqual({ hits: 2, plotted: 3, dates: 1 });
  expect(targetBounds(size, "yd").right).toBeCloseTo(3 / 0.9144);
});
it("falls back to distinct clubs in the available set after filters change", () => {
  const other = { ...shot, club_id: "a-8", club_label: "8 iron" };
  const c = targetClubs(
    [other, shot, { ...shot, set_id: "b", club_id: "b-7" }],
    "a",
    "b-7",
    "a-7",
  );
  expect([c.a.club_id, c.b.club_id]).toEqual(["a-7", "a-8"]);
  expect(targetClubs([other], "missing", "", "").b).toBeUndefined();
});
