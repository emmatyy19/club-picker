import { expect, it } from "vitest";
import { consistencyDates } from "../src/ConsistencyView";
import { shot } from "./fixtures";
it("merges date restarts, retains mishits and omits sparse or invalid dates", () => {
  const rows = [0, 100, 110, 120, 130].map((v, i) => ({
    ...shot,
    carry_m: v,
    session_id: `restart-${i}`,
    shot_id: String(i),
  }));
  const points = consistencyDates(
    [
      ...rows,
      { ...shot, session_date: "2026-02-01" },
      { ...shot, session_date: null },
      { ...shot, quality: "excluded", exclusion_reason: "error" },
    ],
    "m",
  );
  expect(points).toHaveLength(1);
  expect(points[0]).toMatchObject({
    median: 110,
    spread: 130,
    shots: 5,
    date: "2026-01-01",
  });
  expect(consistencyDates(rows, "yd")[0].median).toBeCloseTo(110 / 0.9144);
});
