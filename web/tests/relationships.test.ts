import { expect, it } from "vitest";
import { relationshipPoints } from "../src/RelationshipsView";
import { shot } from "./fixtures";
it("preserves low shots and unknown color data, excludes missing speed and flagged shots, converts units", () => {
  const rows = [
    { ...shot, ball_speed_mps: 44.704, carry_m: 91.44 },
    { ...shot, ball_speed_mps: 0, carry_m: 0 },
    { ...shot, ball_speed_mps: null },
    { ...shot, quality: "excluded" as const, ball_speed_mps: 50 },
  ];
  const points = relationshipPoints(rows, "yd");
  expect(points).toHaveLength(2);
  expect(points[0].speed).toBeCloseTo(100);
  expect(points[0].carry).toBeCloseTo(100);
  expect(points[1]).toMatchObject({ speed: 0, carry: 0 });
  expect(relationshipPoints(rows, "m")[0]).toMatchObject({
    speed: 44.704,
    carry: 91.44,
  });
});

it("pairs club and ball speed, keeps zero ball speed, and leaves undefined ratios unknown", async () => {
  const { efficiencyPoints } = await import("../src/RelationshipsView");
  const { trendValue } = await import("../src/trends");
  const rows = [
    { ...shot, club_speed_mps: 30, ball_speed_mps: 42 },
    { ...shot, club_speed_mps: 30, ball_speed_mps: 0 },
    { ...shot, club_speed_mps: 0, ball_speed_mps: 40 },
    { ...shot, club_speed_mps: null, ball_speed_mps: 40 },
    { ...shot, club_speed_mps: 30, ball_speed_mps: null },
  ];
  expect(efficiencyPoints(rows, "m")).toHaveLength(2);
  expect(efficiencyPoints(rows, "m")[0]).toMatchObject({
    clubSpeed: 30,
    speed: 42,
    smash: 1.4,
  });
  expect(efficiencyPoints(rows, "yd")[0].clubSpeed).toBeCloseTo(30 / 0.44704);
  expect(efficiencyPoints(rows, "yd")[0].smash).toBeCloseTo(1.4);
  expect(efficiencyPoints(rows, "m")[1].smash).toBe(0);
  for (const row of rows.slice(2))
    expect(trendValue(row, "smash", "yd", "carry")).toBeNull();
});
