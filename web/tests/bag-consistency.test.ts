import { expect, it } from "vitest";
import { bagConsistency } from "../src/bagConsistency";
import { shot } from "./fixtures";
const dates = Array.from({ length: 6 }, (_, d) =>
  Array.from({ length: d === 5 ? 40 : 5 }, (_, i) => ({
    ...shot,
    session_date: "2030-01-0" + (d + 1),
    carry_m: 100 + (i % 5) * (d < 3 ? 2 : 1),
    total_m: 120,
    total_side_m: -10 + (i % 5),
  })),
).flat();
it("compares disjoint equal-date windows within the selected set and context", () => {
  const [r] = bagConsistency([...dates].reverse(), "a", "carry", "m", false);
  expect(r.change).toBe(-4);
  expect(r.recent?.spread).toBe(4);
  expect(r.earlier?.dates).toHaveLength(3);
  expect(bagConsistency(dates, "b", "carry", "m", false)).toEqual([]);
  const separated = bagConsistency(
    dates.map((s, i) => ({ ...s, source: i < 15 ? "manual" : "trackman" })),
    "a",
    "carry",
    "m",
    false,
  );
  expect(separated.every((r) => r.change === null)).toBe(true);
});
it("preserves directional bias and sparse measurements and excludes absent offsets", () => {
  const [r] = bagConsistency(dates.slice(0, 3), "a", "side", "yd", false);
  expect(r.recent?.median).toBeCloseTo(-9 / 0.9144);
  expect(r.limited).toBe(true);
  expect(r.change).toBeNull();
  const [missing] = bagConsistency(
    [{ ...shot, carry_side_m: 5 }],
    "a",
    "side",
    "yd",
    false,
  );
  expect(missing.recent).toBeNull();
});
it("sorts by normal bag order or current width", () => {
  const driver = dates.map((s) => ({
    ...s,
    club_id: "driver",
    club_label: "Driver",
    carry_m: 160,
  }));
  const data = [...dates, ...driver];
  expect(
    bagConsistency(data, "a", "carry", "m", false)[0].club.club_label,
  ).toBe("Driver");
  expect(bagConsistency(data, "a", "carry", "m", true)[0].club.club_label).toBe(
    "7 iron",
  );
});
