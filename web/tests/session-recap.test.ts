import { expect, it } from "vitest";
import { sessionRecap } from "../src/sessionRecap";
import { shot } from "./fixtures";
it("uses the latest three supported earlier dates and only clubs present on the selected date", () => {
  const shots = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: d === 3 ? 1 : 5 }, (_, i) => ({
      ...shot,
      session_date: "2030-01-0" + (d + 1),
      carry_m: i * (d + 1),
      total_side_m: d === 5 && i === 0 ? null : i,
    })),
  ).flat();
  const [row, ...others] = sessionRecap(
    [...shots, { ...shots[0], club_id: "other" }].reverse(),
    "2030-01-06",
    "m",
  );
  expect(others).toHaveLength(0);
  expect(row.carry.earlier?.dates).toEqual([
    "2030-01-02",
    "2030-01-03",
    "2030-01-05",
  ]);
  expect(row.carry.recent?.spread).toBe(24);
  expect(row.side.count).toBe(4);
  expect(row.side.recent).toBeNull();
  const separated = sessionRecap(
    shots.map((s) => ({
      ...s,
      source: s.session_date === "2030-01-06" ? "manual" : "trackman",
    })),
    "2030-01-06",
    "m",
  );
  expect(separated[0].carry.earlier).toBeNull();
});
