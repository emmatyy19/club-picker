import {
  rankFinishApproaches,
  carryWindow,
  windowOutcomes,
} from "../src/approach";
import { describe, expect, it } from "vitest";
import fixtures from "../../tests/fixtures/approach.json";
import {
  approachContext,
  approachProfiles,
  approachTarget,
  rankApproaches,
  summarizeCarry,
} from "../src/approach";
import type { Unit } from "../src/data";
import { shot } from "./fixtures";

describe("approach reference parity", () => {
  it("uses session-balanced quantiles, preserving mishits", () => {
    for (const c of fixtures.summaries)
      expect(summarizeCarry(c.sessions)).toEqual(c.expected);
  });
  it("uses plays-like once, converts units, and does not invent an angle correction", () => {
    for (const c of fixtures.targets)
      expect(
        approachTarget(c.distance, c.playsLike, c.angle, c.unit as Unit),
      ).toBeCloseTo(c.expected, 10);
  });
  it("rejects invalid values", () => {
    for (const sessions of [[], [[]], [[NaN]], [[-1]], [[Infinity]]])
      expect(() => summarizeCarry(sessions)).toThrow();
    for (const [distance, playsLike, angle] of [
      [0, null, null],
      [NaN, null, null],
      [100, 0, null],
      [100, null, 90],
      [100, null, NaN],
    ])
      expect(() => approachTarget(distance!, playsLike, angle, "yd")).toThrow();
  });
  it("separates sets, sources, intent and normalization and excludes flagged shots and drivers", () => {
    const context = approachContext(shot);
    const variants = [
      { set_id: "b" },
      { source: "trackman" as const },
      { intent: "unknown" as const },
      { normalization: "normalized" as const },
      { quality: "excluded" as const, exclusion_reason: "bad measurement" },
      { club_label: "Driver" },
      { intent: "partial" as const },
    ];
    const rows = [
      shot,
      ...variants.map((v, i) => ({ ...shot, shot_id: String(i + 2), ...v })),
    ];
    expect(approachProfiles(rows, "a", context)).toHaveLength(1);
    expect(approachProfiles(rows, "a", context)[0].shots).toBe(1);
    expect(
      approachProfiles(
        rows,
        "a",
        approachContext({ ...shot, intent: "unknown" }),
      )[0].shots,
    ).toBe(1);
  });
  it("ranks carry rather than total and keeps scarce candidates visible", () => {
    const profiles = approachProfiles(
      [
        shot,
        {
          ...shot,
          club_id: "a-6",
          club_label: "6 iron",
          carry_m: 140,
          total_m: 160,
        },
      ],
      "a",
      approachContext(shot),
    );
    expect(rankApproaches(profiles, 139)[0].club.club_id).toBe("a-6");
    expect(rankApproaches(profiles, 129)[0].club.club_id).toBe("a-7");
    expect(rankApproaches(profiles, 200)[0].sessions).toBe(1);
    expect(() => rankApproaches(profiles, NaN)).toThrow();
  });
});

it("keeps recorded partial swings separate without scaling full swings", () => {
  const partial = {
    ...shot,
    shot_id: "partial",
    intent: "partial" as const,
    carry_m: 70,
  };
  const profiles = approachProfiles(
    [shot, partial],
    "a",
    approachContext(partial),
  );
  expect(profiles).toHaveLength(1);
  expect(profiles[0].median).toBe(70);
  expect(profiles[0].club.intent).toBe("partial");
  expect(approachProfiles([shot], "a", approachContext(partial))).toEqual([]);
});

it("counts inclusive carry-window edges with equal session weight", () => {
  const outcomes = windowOutcomes(
    [
      [90, 90, 90, 90],
      [100, 110, 120],
    ],
    carryWindow(100, 110, "m"),
  );
  expect(outcomes.short).toBeCloseTo(0.5);
  expect(outcomes.within).toBeCloseTo(1 / 3);
  expect(outcomes.long).toBeCloseTo(1 / 6);
  expect(Object.values(outcomes).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
});
it("converts window units and rejects incomplete or reversed bounds", () => {
  expect(carryWindow(100, 120, "yd")).toEqual({ front: 91.44, back: 109.728 });
  for (const pair of [
    [0, 120],
    [120, 100],
    [100, 100],
    [NaN, 120],
    [100, Infinity],
  ])
    expect(() => carryWindow(pair[0], pair[1], "m")).toThrow();
  expect(() => windowOutcomes([], carryWindow(100, 120, "m"))).toThrow();
});

it("ranks window fit ahead of the nearest median only when a window is supplied", () => {
  const rows = [80, 100, 140].map((carry_m, i) => ({
    ...shot,
    shot_id: String(i),
    carry_m,
  }));
  rows.push(
    ...[106, 107, 108].map((carry_m, i) => ({
      ...shot,
      club_id: "a-6",
      club_label: "6 iron",
      shot_id: `b${i}`,
      carry_m,
    })),
  );
  const profiles = approachProfiles(rows, "a", approachContext(shot));
  expect(rankApproaches(profiles, 100)[0].club.club_id).toBe("a-7");
  expect(
    rankApproaches(profiles, 100, carryWindow(95, 110, "m"))[0].club.club_id,
  ).toBe("a-6");
});

it("compares reported finish separately from carry and prioritizes observed clearance", () => {
  const a = { ...shot, carry_m: 100, total_m: 130 };
  const b = {
    ...shot,
    club_id: "a-6",
    club_label: "6 iron",
    carry_m: 120,
    total_m: 145,
  };
  const profiles = approachProfiles([a, b], "a", approachContext(a));
  expect(rankFinishApproaches(profiles, 130)[0].club.club_id).toBe("a-7");
  const constrained = rankFinishApproaches(profiles, 130, null, 110);
  expect(constrained[0].club.club_id).toBe("a-6");
  expect(constrained[0].clears).toBe(1);
  expect(constrained[1].clears).toBe(0);
  expect(
    rankFinishApproaches(profiles, 130, null, 100).find(
      (p) => p.club.club_id === "a-7",
    )?.clears,
  ).toBe(0);
});
it("does not invent missing totals or pool different total measurement bases", () => {
  const rows = [
    shot,
    { ...shot, shot_id: "2", total_m: 140, total_basis: "modeled" as const },
  ];
  const profiles = approachProfiles(rows, "a", approachContext(shot));
  expect(profiles[0].total).toBeNull();
  expect(rankFinishApproaches(profiles, 130)[0].gap).toBeNull();
  expect(() => rankFinishApproaches(profiles, 130, null, NaN)).toThrow();
});
it("calculates total summaries on observed totals only and keeps session support", () => {
  const rows = [
    shot,
    { ...shot, shot_id: "2", total_m: 140 },
    { ...shot, shot_id: "3", session_id: "later", total_m: 160 },
  ];
  const profile = approachProfiles(rows, "a", approachContext(shot))[0];
  expect(profile.total).toMatchObject({ median: 150, shots: 2, sessions: 2 });
  expect(profile.shots).toBe(3);
});

it("prefers joint landing and clearance fit over a club that always overshoots", () => {
  const rows = [110, 110, 90].map((carry_m, i) => ({
    ...shot,
    shot_id: String(i),
    carry_m,
    total_m: 125,
  }));
  rows.push({
    ...shot,
    club_id: "long",
    club_label: "3 wood",
    carry_m: 160,
    total_m: 180,
    shot_id: "long",
  });
  const ranked = rankFinishApproaches(
    approachProfiles(rows, "a", approachContext(shot)),
    125,
    carryWindow(105, 120, "m"),
    100,
  );
  expect(ranked[0].club.club_id).toBe("a-7");
  expect(ranked[0].fits).toBeCloseTo(2 / 3);
  expect(ranked[1].fits).toBe(0);
  expect(ranked[1].clears).toBe(1);
});
