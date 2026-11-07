import { expect, it } from "vitest";
import { missCounts, missPeriods } from "../src/MissPatterns";
import { shot } from "./fixtures";
it("includes corridor boundaries and preserves misses on both sides", () => {
  expect(missCounts([-21, -20, 0, 20, 21], 40)).toEqual([1, 3, 1]);
  expect(missCounts([], 40)).toEqual([0, 0, 0]);
});
it("uses matching side, combines date restarts and excludes sparse or flagged dates", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    ...shot,
    session_id: String(i),
    carry_side_m: i,
    total_side_m: 100,
    total_m: 150,
  }));
  const extra = [
    { ...rows[0], quality: "excluded" as const },
    { ...rows[0], session_date: null },
    { ...rows[0], session_date: "2026-01-02" },
  ];
  expect(missPeriods([...rows, ...extra], "carry", "m")).toEqual([
    ["2026-01-01", [0, 1, 2, 3, 4]],
  ]);
  expect(missPeriods(rows, "total", "yd")[0][1][0]).toBeCloseTo(100 / 0.9144);
});
