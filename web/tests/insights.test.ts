import { describe, expect, it } from "vitest";
import fixtures from "../../tests/fixtures/practice-insights.json";
import {
  compareDates,
  comparisonGroups,
  dateMeasurements,
  distanceGroups,
  summarizeDates,
} from "../src/insights";
import { shot } from "./fixtures";
import type { Shot } from "../src/data";

function history(): Shot[] {
  return Array.from({ length: 6 }, (_, d) =>
    Array.from({ length: 5 }, (_, i) => ({
      ...shot,
      session_date: `2030-01-0${d + 1}`,
      session_id: `s-${d}`,
      shot_id: `${d}-${i}`,
      carry_m: 100 + i * 5 + (d >= 3 ? 10 : 0),
      total_side_m: i * 5 - 10,
      total_m: 150,
    })),
  ).flat();
}
describe("practice reference parity", () => {
  it("matches Python equal-date signed quantiles and disjoint windows", () => {
    for (const c of fixtures.summaries)
      expect(c.expected).toMatchObject(
        summarizeDates(new Map(Object.entries(c.dates))),
      );
    for (const c of fixtures.comparisons) {
      const actual = compareDates(new Map(Object.entries(c.dates)));
      expect(actual.eligible).toBe(c.expected.eligible);
      if (actual.earlier)
        expect(c.expected.earlier).toMatchObject(actual.earlier);
      else expect(c.expected.earlier).toBeNull();
      if (actual.recent) expect(c.expected.recent).toMatchObject(actual.recent);
      else expect(c.expected.recent).toBeNull();
    }
  });
  it("rejects empty dates and nonfinite values", () => {
    for (const values of [
      new Map(),
      new Map([["a", []]]),
      new Map([["a", [Infinity]]]),
    ])
      expect(() => summarizeDates(values)).toThrow();
  });
  it("merges date restarts, preserves zero side and excludes flagged/undated records", () => {
    const rows = history();
    const extra = {
      ...rows[0],
      session_id: "restart",
      shot_id: "extra",
      total_side_m: 0,
    };
    const values = dateMeasurements(
      [
        ...rows,
        extra,
        { ...extra, quality: "excluded", exclusion_reason: "error" },
        { ...extra, session_date: null },
      ],
      "side",
      "m",
      "total",
    );
    expect(values.get("2030-01-01")).toHaveLength(6);
    expect(values.size).toBe(6);
    expect(dateMeasurements(rows, "side", "m", "carry").size).toBe(0);
    const compare = compareDates(
      dateMeasurements(rows, "carry", "yd", "carry"),
    );
    expect(compare.earlier!.dates).toEqual([
      "2030-01-01",
      "2030-01-02",
      "2030-01-03",
    ]);
    expect(compare.recent!.median - compare.earlier!.median).toBeCloseTo(
      10 / 0.9144,
    );
    expect(compareDates(new Map([...values].slice(0, 5))).recent).toBeNull();
    expect(
      compareDates(new Map([...values].map(([d, v]) => [d, v.slice(0, 4)])))
        .eligible,
    ).toBe(0);
  });
  it("separates sets, sources, intent and both bases unless explicitly combined", () => {
    const rows = history();
    const variants: Partial<Shot>[] = [
      { club_id: "b-7", set_id: "b" },
      { source: "toptracer" },
      { intent: "partial" },
      { total_basis: "modeled" },
      { carry_basis: "measured" },
    ];
    const mixed = [
      ...rows,
      ...variants.flatMap((v) => rows.map((s) => ({ ...s, ...v }))),
    ];
    expect(comparisonGroups(mixed, "carry", "m", "carry", false)).toHaveLength(
      6,
    );
    expect(comparisonGroups(mixed, "carry", "m", "carry", true)).toHaveLength(
      1,
    );
  });
  it("uses selected dates and shared dates for normally ordered adjacent club gaps", () => {
    const rows = history();
    const eight = rows.map((s) => ({
      ...s,
      club_id: "a-8",
      club_label: "8 iron",
      carry_m: s.carry_m - 10,
    }));
    const nine = rows
      .filter((s) => s.session_date === "2030-01-01")
      .map((s) => ({
        ...s,
        club_id: "a-9",
        club_label: "9 iron",
        carry_m: s.carry_m - 20,
      }));
    const bands = distanceGroups([...nine, ...eight, ...rows], "carry", "m")[0]
      .bands;
    expect(bands.map((b) => b.shot.club_label)).toEqual([
      "7 iron",
      "8 iron",
      "9 iron",
    ]);
    expect(bands[0].gap).toBe(10);
    expect(bands[0].sharedDates).toBe(6);
    expect(bands[1].gap).toBe(10);
    expect(bands[1].sharedDates).toBe(1);
    expect(bands[2].gap).toBeNull();
    const limited = [...rows, ...eight, ...nine].filter(
      (s) => s.session_date! >= "2030-01-04",
    );
    expect(
      distanceGroups(limited, "carry", "m")[0].bands[0].summary!.dates,
    ).toHaveLength(3);
    const sparseEight = eight.filter((s) => !s.shot_id.endsWith("4"));
    const sparse = distanceGroups(
      [...rows, ...sparseEight, ...nine],
      "carry",
      "m",
    )[0].bands;
    expect(sparse[0].gap).toBeNull();
    expect(sparse[1].summary).toBeNull();
  });
});

it("compares shared dates independently and preserves reversed gaps", async () => {
  const { sharedClubDates } = await import("../src/insights");
  const first = new Map([
    ["2026-01-01", [100, 100, 100, 100, 100]],
    ["2026-01-02", [110, 110, 110, 110, 110]],
    ["2026-01-03", [120, 120, 120, 120, 120]],
    ["2026-01-04", [100]],
  ]);
  const second = new Map([
    ["2026-01-01", [104, 104, 104, 104, 104]],
    ["2026-01-02", [106, 106, 106, 106, 106]],
    ["2026-01-04", [100, 100, 100, 100, 100]],
  ]);
  const result = sharedClubDates(first, second);
  expect(result.map((d) => [d.date, d.gap])).toEqual([
    ["2026-01-02", 4],
    ["2026-01-01", -4],
  ]);
  expect(result[0].a.shots).toBe(5);
  expect(sharedClubDates(new Map(), second)).toEqual([]);
});
