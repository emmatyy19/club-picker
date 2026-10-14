import { describe, expect, it } from "vitest";
import { dispersionContours } from "../src/dispersion";
import { groups, type Shot } from "../src/data";
import { shot } from "./fixtures";

const ring = (
  n: number,
  overrides: Partial<Shot>,
  x: number,
  y: number,
): Shot[] =>
  Array.from({ length: n }, (_, i) => ({
    ...shot,
    ...overrides,
    shot_id: String(i + 1),
    total_side_m: x + 5 * Math.cos((i / n) * 2 * Math.PI),
    total_m: y + 10 * Math.sin((i / n) * 2 * Math.PI),
  }));
const config = {
  metric: "total" as const,
  unit: "m" as const,
  view: "dispersion" as const,
  coverage: 0.8,
};
const center = (points: [number, number][]) => [
  (points[0][0] + points[48][0]) / 2,
  (points[0][1] + points[48][1]) / 2,
];

describe("Separate and combined dispersion", () => {
  it("explains three measurement contexts for two physical clubs and pools only plotted shots", () => {
    const rows = [
      ...ring(10, { source: "trackman" }, -20, 120),
      ...ring(10, { source: "toptracer" }, 20, 140),
      ...ring(10, { source: "toptracer", club_id: "b-7", set_id: "b" }, 0, 160),
      {
        ...shot,
        source: "trackman" as const,
        total_m: 100,
        total_side_m: null,
      },
      {
        ...shot,
        total_m: 999,
        total_side_m: 500,
        quality: "excluded" as const,
      },
    ];
    const separate = dispersionContours({
      ...config,
      shots: rows,
      mode: "separate",
    });
    expect(separate.map((c) => c.label)).toEqual([
      "7 iron · a · trackman",
      "7 iron · a · toptracer",
      "7 iron · b · toptracer",
    ]);
    expect(separate.map((c) => c.dash)).toEqual(["solid", "dashed", "dotted"]);
    const combined = dispersionContours({
      ...config,
      shots: rows,
      mode: "combined",
    });
    expect(combined).toHaveLength(1);
    expect(combined[0].shape.n).toBe(30);
    expect(combined[0].shape.enclosed).toBeGreaterThanOrEqual(24);
    expect(combined[0].groupCount).toBe(3);
    expect(center(combined[0].shape.points)[0]).toBeCloseTo(0);
    expect(center(combined[0].shape.points)[1]).toBeCloseTo(140);
    // Pooling is a chart operation; the physical identities remain available.
    expect(groups(rows, "total")).toHaveLength(3);
    expect(new Set(combined[0].rows.map((s) => s.club_id)).size).toBe(2);
  });

  it("weights individual shots equally, including small groups", () => {
    const rows = [
      ...ring(12, { source: "trackman" }, 0, 100),
      ...ring(6, { source: "toptracer" }, 30, 160),
    ];
    expect(
      dispersionContours({ ...config, shots: rows, mode: "separate" }),
    ).toHaveLength(1);
    const combined = dispersionContours({
      ...config,
      shots: rows,
      mode: "combined",
    })[0];
    expect(combined.shape.n).toBe(18);
    expect(center(combined.shape.points)[0]).toBeCloseTo(10);
    expect(center(combined.shape.points)[1]).toBeCloseTo(120);
  });

  it("recalculates overhead in displayed coordinates and excludes unavailable geometry", () => {
    const rows = ring(12, { source: "toptracer" }, 20, 140);
    const mixed = [
      ...rows,
      ...ring(12, { source: "manual" }, 0, 120),
      { ...rows[0], total_m: 5, total_side_m: 20 },
    ];
    const contours = dispersionContours({
      ...config,
      shots: mixed,
      view: "overhead",
      mode: "combined",
    });
    expect(contours[0].shape.n).toBe(12);
    const expectedForward =
      rows.reduce(
        (sum, s) => sum + Math.sqrt(s.total_m! ** 2 - s.total_side_m! ** 2),
        0,
      ) / 12;
    expect(center(contours[0].shape.points)[1]).toBeCloseTo(expectedForward);
    const yards = dispersionContours({
      ...config,
      shots: mixed,
      view: "overhead",
      unit: "yd",
      mode: "combined",
    });
    expect(center(yards[0].shape.points)[1] * 0.9144).toBeCloseTo(
      expectedForward,
    );
    expect(
      dispersionContours({
        ...config,
        shots: rows,
        metric: "carry",
        view: "overhead",
        mode: "combined",
      }),
    ).toEqual([]);
  });

  it("suppresses unavailable contours and keeps controls out of the distance plot", () => {
    const rows = ring(12, {}, 0, 120);
    expect(
      dispersionContours({
        ...config,
        shots: rows,
        coverage: 0,
        mode: "combined",
      }),
    ).toEqual([]);
    expect(
      dispersionContours({
        ...config,
        shots: rows,
        view: "distance",
        mode: "combined",
      }),
    ).toEqual([]);
    expect(
      dispersionContours({
        ...config,
        shots: rows.slice(0, 9),
        mode: "combined",
      }),
    ).toEqual([]);
    expect(
      dispersionContours({
        ...config,
        shots: rows.map((s) => ({ ...s, total_side_m: 0 })),
        mode: "combined",
      }),
    ).toEqual([]);
  });
});
