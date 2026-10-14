import { describe, expect, it } from "vitest";
import { parseSnapshot } from "../src/data";
import {
  sessionTrends,
  trendContext,
  trendUnit,
  trendValue,
} from "../src/trends";
import { shot, snapshot } from "./fixtures";
describe("Session trends", () => {
  it("orders actual sessions chronologically and calculates median and observed ranges", () => {
    const later = {
      ...shot,
      shot_id: "later",
      session_id: "later",
      session_date: "2026-03-01",
      carry_m: 200,
    };
    const rows = [
      later,
      ...[0, 100, 120, 140, 160].map((v, i) => ({
        ...shot,
        shot_id: String(i),
        carry_m: v,
      })),
    ];
    const result = sessionTrends(rows, "carry", "m", "total");
    expect(result.map((s) => s.date)).toEqual(["2026-01-01", "2026-03-01"]);
    expect(result[0]).toMatchObject({ median: 120, low: 40, high: 152, n: 5 });
    expect(result[1].n).toBe(1);
  });
  it("never merges clubs, physical sets, providers or measurement contexts", () => {
    const variants = [
      shot,
      { ...shot, club_id: "other" },
      { ...shot, source: "trackman" as const },
      { ...shot, normalization_settings: "25 C" },
      { ...shot, total_basis: "modeled" as const },
    ];
    expect(
      new Set(variants.map((s) => trendContext(s, "ball_speed", "total"))).size,
    ).toBe(5);
    expect(sessionTrends(variants, "carry", "m", "total")).toHaveLength(4);
  });
  it("keeps signed side, missing data and zero distinct; excludes flagged and undated shots", () => {
    const rows = [
      shot,
      { ...shot, shot_id: "2", total_side_m: 0 },
      { ...shot, shot_id: "3", total_side_m: -10 },
      { ...shot, shot_id: "4", total_side_m: 10 },
      { ...shot, shot_id: "5", session_date: null, total_side_m: 100 },
      {
        ...shot,
        shot_id: "6",
        quality: "excluded" as const,
        total_side_m: 200,
      },
    ];
    expect(sessionTrends(rows, "side", "m", "total")[0]).toMatchObject({
      n: 3,
      median: 0,
      low: -8,
      high: 8,
    });
    expect(sessionTrends(rows, "side", "m", "carry")).toEqual([]);
  });
  it("computes sideways width separately from median bias and suppresses singleton spread", () => {
    const rows = [-10, 0, 10].map((v, i) => ({
      ...shot,
      shot_id: String(i),
      total_side_m: v,
    }));
    expect(sessionTrends(rows, "spread", "m", "total")[0]).toMatchObject({
      median: 16,
      low: null,
      high: null,
      n: 3,
    });
    expect(sessionTrends(rows.slice(0, 1), "spread", "m", "total")).toEqual([]);
  });
  it("combines selected clubs and providers by date, weighting shots equally", () => {
    const variants = [
      ...[100, 120, 140].map((value, i) => ({
        ...shot,
        shot_id: String(i),
        carry_m: value,
      })),
      {
        ...shot,
        club_id: "b-7",
        set_id: "b",
        source: "trackman" as const,
        session_id: "other",
        carry_m: 200,
      },
      {
        ...shot,
        session_date: "2026-02-01",
        session_id: "later",
        carry_m: 160,
      },
      { ...shot, session_date: null, carry_m: 999 },
      { ...shot, quality: "excluded" as const, carry_m: 999 },
    ];
    const combined = sessionTrends(variants, "carry", "m", "total", "combined");
    expect(combined).toHaveLength(2);
    expect(combined[0]).toMatchObject({
      date: "2026-01-01",
      n: 4,
      median: 130,
      low: 106,
      high: 182,
      context: "combined",
    });
    expect(combined[1]).toMatchObject({ n: 1, median: 160 });
    expect(new Set(combined[0].shots.map((p) => p.shot.club_id)).size).toBe(2);
    expect(sessionTrends(variants, "carry", "m", "total")).toHaveLength(3);
  });
  it("pools raw sideways values before calculating daily width, rather than averaging widths", () => {
    const variants = [
      { ...shot, total_side_m: -10 },
      {
        ...shot,
        club_id: "b-7",
        set_id: "b",
        source: "trackman" as const,
        total_side_m: 10,
      },
    ];
    expect(sessionTrends(variants, "spread", "m", "total")).toEqual([]);
    expect(
      sessionTrends(variants, "spread", "m", "total", "combined")[0],
    ).toMatchObject({ n: 2, median: 16, low: null, high: null });
  });
  it("keeps separate contexts inside one session independently addressable", () => {
    const variants = [shot, { ...shot, normalization: "normalized" as const }];
    const summaries = sessionTrends(variants, "carry", "m", "total");
    expect(summaries).toHaveLength(2);
    expect(new Set(summaries.map((s) => s.session)).size).toBe(2);
  });
  it("converts speeds and distances explicitly, without converting spin or angles", () => {
    const s = {
      ...shot,
      ball_speed_mps: 44.704,
      spin_rpm: 5000,
      apex_m: 9.144,
      launch_deg: 18,
    };
    expect(trendValue(s, "ball_speed", "yd", "carry")).toBeCloseTo(100);
    expect(trendValue(s, "ball_speed", "m", "carry")).toBe(44.704);
    expect(trendValue(s, "height", "yd", "carry")).toBeCloseTo(10);
    expect(trendValue(s, "spin", "yd", "carry")).toBe(5000);
    expect(trendValue(s, "launch", "yd", "carry")).toBe(18);
    expect(trendValue(shot, "spin", "yd", "carry")).toBeNull();
    expect(trendUnit("ball_speed", "yd")).toBe("mph");
  });
  it("accepts older snapshots and only permits declared, finite flight fields", () => {
    expect(
      parseSnapshot(snapshot([shot])).shots[0].ball_speed_mps,
    ).toBeUndefined();
    const enriched = {
      ...shot,
      ball_speed_mps: 44.704,
      spin_rpm: null,
      curve_m: -5,
    };
    expect(parseSnapshot(snapshot([enriched])).shots[0]).toEqual(enriched);
    for (const fields of [
      { spin_rpm: -1 },
      { ball_speed_mps: Infinity },
      { launch_deg: 100 },
      { apex_m: -1 },
      { venue: "private" },
    ]) {
      expect(() => parseSnapshot(snapshot([{ ...shot, ...fields }]))).toThrow();
    }
  });
});
