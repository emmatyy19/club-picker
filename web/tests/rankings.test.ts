import { describe, expect, it } from "vitest";
import { emptyFilters, filterShots, type Shot } from "../src/data";
import { rankClubs } from "../src/rankings";
import { shot } from "./fixtures";
const options = {
  metric: "carry" as const,
  lateral: "total" as const,
  unit: "m" as const,
  statistic: "range" as const,
  minShots: 1,
};
function club(id: string, label: string, distances: number[]): Shot[] {
  return distances.map((v, i) => ({
    ...shot,
    club_id: id,
    club_label: label,
    shot_id: `${id}-${i}`,
    carry_m: v,
  }));
}
describe("Observed club rankings", () => {
  it("distinguishes absolute spread from spread relative to club length", () => {
    const rows = [
      ...club("driver", "Driver", [180, 190, 200, 210, 220]),
      ...club("wedge", "PW", [40, 44, 48, 52, 56]),
    ];
    const raw = rankClubs(rows, options).rows;
    expect(raw.map((r) => r.club.club_id)).toEqual(["wedge", "driver"]);
    expect(raw[0]).toMatchObject({
      low: 41.6,
      high: 54.4,
      median: 48,
      n: 5,
      sessions: 1,
    });
    expect(raw[0].score).toBeCloseTo(12.8);
    const relative = rankClubs(rows, {
      ...options,
      statistic: "relative",
    }).rows;
    expect(relative.map((r) => r.club.club_id)).toEqual(["driver", "wedge"]);
    expect(relative[0].score).toBeCloseTo(16);
    expect(relative[1].score).toBeCloseTo((100 * 12.8) / 48);
  });
  it("separates tight grouping from accuracy, preserving signed left/right bias", () => {
    const biased = club("biased", "7 iron", [100, 101, 102]).map((s) => ({
      ...s,
      total_m: 130,
      total_side_m: 20,
    }));
    const centered = club("centered", "6 iron", [100, 101, 102]).map(
      (s, i) => ({ ...s, total_m: 130, total_side_m: [-2, 0, 2][i] }),
    );
    const rows = [...biased, ...centered];
    expect(
      rankClubs(rows, { ...options, metric: "side" }).rows[0],
    ).toMatchObject({ median: 20, score: 0 });
    expect(
      rankClubs(rows, { ...options, metric: "side", statistic: "miss" }).rows[0]
        .club.club_id,
    ).toBe("centered");
    expect(
      rankClubs(rows, { ...options, metric: "side", lateral: "carry" }),
    ).toMatchObject({ rows: [], unavailable: 2 });
  });
  it("enforces measured sample thresholds and never ranks singleton ranges as perfect consistency", () => {
    const rows = [
      ...club(
        "large",
        "Driver",
        Array.from({ length: 10 }, (_, i) => 100 + i),
      ),
      ...club("small", "PW", [50, 55]),
      ...club("one", "GW", [10]),
    ];
    expect(rankClubs(rows, { ...options, minShots: 10 })).toMatchObject({
      rows: [{ n: 10 }],
      insufficient: 2,
    });
    expect(rankClubs(rows, options)).toMatchObject({ insufficient: 1 });
    expect(
      rankClubs(rows, { ...options, statistic: "median_high" }).rows,
    ).toHaveLength(3);
  });
  it("never pools provider or physical-club contexts and respects dates and flags", () => {
    const base = club("a", "7 iron", [100, 110, 120]);
    const other = base.map((s) => ({
      ...s,
      shot_id: `b-${s.shot_id}`,
      club_id: "b",
      set_id: "b",
    }));
    const changed = base.map((s) => ({
      ...s,
      shot_id: `c-${s.shot_id}`,
      normalization_settings: "25 C",
    }));
    const later = base.map((s) => ({
      ...s,
      shot_id: `d-${s.shot_id}`,
      session_id: "later",
      session_date: "2026-02-01",
    }));
    const all = [
      ...base,
      ...other,
      ...changed,
      ...later,
      {
        ...shot,
        shot_id: "flagged",
        club_id: "a",
        carry_m: 10000,
        quality: "excluded" as const,
      },
    ];
    expect(rankClubs(all, options).rows).toHaveLength(3);
    expect(
      rankClubs(all, options).rows.find(
        (r) =>
          r.club.club_id === "a" && r.club.normalization_settings === "unknown",
      ),
    ).toMatchObject({ n: 6, sessions: 2, score: 20 });
    const filtered = filterShots(all, { ...emptyFilters, start: "2026-02-01" });
    expect(rankClubs(filtered, options).rows).toMatchObject([
      { n: 3, sessions: 1 },
    ]);
  });
  it("keeps genuine mishits and undated shots, counts dated sessions explicitly and gives ties the same rank", () => {
    const a = club("a", "Driver", [0, 100, 120, 140, 160]);
    const b = club("b", "3 wood", [0, 100, 120, 140, 160]).map((s) => ({
      ...s,
      session_date: null,
    }));
    const result = rankClubs([...b, ...a], options).rows;
    expect(result.map((r) => r.rank)).toEqual([1, 1]);
    expect(result[0].score).toBe(112);
    expect(result[1]).toMatchObject({ sessions: 0, undated: 5 });
  });
  it("converts absolute widths consistently, keeps relative widths unitless and handles zero medians", () => {
    const rows = club("a", "7 iron", [100, 110, 120]);
    expect(
      rankClubs(rows, { ...options, unit: "yd" }).rows[0].score * 0.9144,
    ).toBeCloseTo(16);
    expect(
      rankClubs(rows, { ...options, unit: "yd", statistic: "relative" }).rows[0]
        .score,
    ).toBeCloseTo(
      rankClubs(rows, { ...options, statistic: "relative" }).rows[0].score,
    );
    expect(
      rankClubs(club("zero", "PW", [0, 0]), {
        ...options,
        statistic: "relative",
      }),
    ).toMatchObject({ rows: [], unavailable: 1 });
    expect(() => rankClubs(rows, { ...options, minShots: 0 })).toThrow();
    expect(() =>
      rankClubs(rows, { ...options, metric: "spin", statistic: "relative" }),
    ).toThrow();
    expect(() => rankClubs(rows, { ...options, statistic: "miss" })).toThrow();
  });
});
