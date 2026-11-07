import { expect, it } from "vitest";
import { rolloutSummary } from "../src/RolloutView";
import { shot } from "./fixtures";
it("summarizes per-shot differences rather than subtracting marginal medians", () => {
  const rows = [
    [100, 200],
    [110, 111],
    [120, 121],
    [130, 131],
    [140, 141],
  ].map(([carry, total]) => ({ ...shot, carry_m: carry, total_m: total }));
  const result = rolloutSummary(rows, "m")!;
  expect(result.rollout.median).toBe(1);
  expect(result.total.median - result.carry.median).toBe(11);
  expect(rolloutSummary(rows, "yd")!.rollout.median).toBeCloseTo(1 / 0.9144);
});
it("keeps negative differences, excludes missing pairs and sparse dates", () => {
  const rows = Array.from({ length: 5 }, () => ({
    ...shot,
    carry_m: 100,
    total_m: 99,
  }));
  const result = rolloutSummary(
    [
      ...rows,
      { ...shot, total_m: null },
      { ...shot, total_m: 120, session_date: "2026-02-01" },
    ],
    "m",
  )!;
  expect(result.negative).toBe(5);
  expect(result.rollout.median).toBe(-1);
  expect(result.omitted).toBe(2);
  expect(rolloutSummary(rows.slice(0, 4), "m")).toBeNull();
});
it("weights practice dates equally despite differing shot counts", () => {
  const rows = [
    ...Array.from({ length: 5 }, () => ({
      ...shot,
      total_m: shot.carry_m + 10,
    })),
    ...Array.from({ length: 50 }, () => ({
      ...shot,
      total_m: shot.carry_m + 30,
      session_date: "2026-02-01",
    })),
  ];
  expect(rolloutSummary(rows, "m")!.rollout.median).toBe(20);
});
