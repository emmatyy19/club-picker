import { describe, expect, it } from "vitest";
import {
  distance,
  overheadPoint,
  overheadBounds,
  color,
  clubOrder,
  compareClubs,
  plottedShots,
  setColor,
  ellipse,
  emptyFilters,
  filterShots,
  groupKey,
  groups,
  parseSnapshot,
  quantile,
  recentSessionFilters,
  sessionKey,
  side,
  type Shot,
} from "../src/data";
import { shot, snapshot } from "./fixtures";
const rows = [
  shot,
  {
    ...shot,
    shot_id: "2",
    club_id: "b-7",
    set_id: "b",
    source: "trackman" as const,
    session_id: "invented-2",
    session_date: "2026-02-01",
  },
  {
    ...shot,
    shot_id: "3",
    club_id: "a-6",
    club_label: "6 iron",
    session_date: null,
    session_id: "undated",
  },
];
describe("Recent practice dates", () => {
  it("does not turn an empty or undated library into an all-dates selection", () => {
    expect(() => recentSessionFilters([], emptyFilters, 1)).toThrow();
    expect(() =>
      recentSessionFilters([{ ...shot, session_date: null }], emptyFilters, 1),
    ).toThrow();
  });
  const history = [
    ...rows,
    {
      ...shot,
      session_id: "same-day-other-source",
      source: "toptracer" as const,
      session_date: "2026-02-01",
    },
    { ...shot, session_id: "middle", session_date: "2026-01-20" },
  ];
  it("uses calendar order, includes same-day sources, and excludes undated shots", () => {
    const latest = recentSessionFilters(history, emptyFilters, 1);
    expect([latest.start, latest.end]).toEqual(["2026-02-01", "2026-02-01"]);
    expect(filterShots(history, latest)).toHaveLength(2);
    const lastTwo = recentSessionFilters(
      [...history].reverse(),
      emptyFilters,
      2,
    );
    expect([lastTwo.start, lastTwo.end]).toEqual(["2026-01-20", "2026-02-01"]);
    expect(filterShots(history, lastTwo)).toHaveLength(3);
  });
  it("replaces date/session selection while preserving tags and match mode", () => {
    const prior = {
      ...emptyFilters,
      session: sessionKey(shot),
      undated: true,
      mode: "any" as const,
      tags: [{ field: "source" as const, value: "toptracer" }],
    };
    const next = recentSessionFilters(history, prior, 20);
    expect(next).toEqual({
      ...prior,
      session: "",
      undated: false,
      start: "2026-01-01",
      end: "2026-02-01",
    });
    expect(filterShots(history, next)).toHaveLength(1);
    for (const n of [0, -1, 1.5, NaN])
      expect(() => recentSessionFilters(history, prior, n)).toThrow();
  });
});
describe("Snapshot boundary", () => {
  it("keeps missing separate from zero and converts units", () => {
    expect(distance(shot, "carry", "yd")).toBeCloseTo(140);
    expect(side(shot, "carry", "yd")).toBeNull();
    expect(side({ ...shot, carry_side_m: 0 }, "carry", "yd")).toBe(0);
    expect(distance(shot, "total", "m")).toBeNull();
  });
  it("deduplicates identical identities but rejects conflicts", () => {
    expect(parseSnapshot(snapshot([shot, shot])).shots).toHaveLength(1);
    expect(() =>
      parseSnapshot(snapshot([shot, { ...shot, carry_m: 1 }])),
    ).toThrow("Conflicting measurements");
  });
  it("rejects unknown fields, invalid dates, nonfinite values and unmatched total-side", () => {
    for (const extra of [
      { venue: "private unknown field" },
      { session_date: "2026-02-30" },
      { carry_m: Infinity },
      { carry_m: -1 },
      { total_side_m: 2 },
      { quality: "excluded" },
    ])
      expect(() =>
        parseSnapshot(snapshot([{ ...shot, ...extra } as Shot])),
      ).toThrow();
  });
  it("rejects conflicting equipment and dates", () => {
    expect(() =>
      parseSnapshot(snapshot([shot, { ...shot, shot_id: "2", set_id: "b" }])),
    ).toThrow("physical club");
    expect(() =>
      parseSnapshot(
        snapshot([shot, { ...shot, shot_id: "2", session_date: null }]),
      ),
    ).toThrow("session");
  });
  it("roundtrips a backup and preserves contexts and units", () => {
    const parsed = parseSnapshot(snapshot(rows));
    expect(parseSnapshot(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });
});
describe("Membership and contexts", () => {
  it("ORs within fields, ANDs across fields; supports flat any/all", () => {
    const f = {
      ...emptyFilters,
      tags: [
        { field: "club_label" as const, value: "7 iron" },
        { field: "club_label" as const, value: "6 iron" },
        { field: "source" as const, value: "trackman" },
      ],
    };
    expect(filterShots(rows, f)).toEqual([rows[1]]);
    expect(filterShots(rows, { ...f, mode: "any" })).toHaveLength(3);
    expect(filterShots(rows, { ...f, mode: "all" })).toHaveLength(0);
  });
  it("uses inclusive dates, distinct session identities and explicit undated selection", () => {
    expect(filterShots(rows, emptyFilters)).toHaveLength(3);
    expect(
      filterShots(rows, {
        ...emptyFilters,
        start: "2026-01-01",
        end: "2026-01-01",
      }),
    ).toEqual([shot]);
    expect(filterShots(rows, { ...emptyFilters, undated: true })).toEqual([
      rows[2],
    ]);
    expect(
      filterShots(rows, { ...emptyFilters, session: sessionKey(rows[1]) }),
    ).toEqual([rows[1]]);
    expect(
      filterShots(rows, {
        ...emptyFilters,
        start: "2026-03-01",
        end: "2026-01-01",
      }),
    ).toEqual([]);
  });
  it("never pools physical sets, settings, or metric bases", () => {
    expect(groups(rows, "carry")).toHaveLength(3);
    expect(groupKey(shot, "carry")).not.toEqual(
      groupKey({ ...shot, normalization_settings: "25 C" }, "carry"),
    );
    expect(groupKey(shot, "total")).not.toEqual(
      groupKey({ ...shot, total_basis: "modeled" }, "total"),
    );
    expect(groups([{ ...shot, quality: "excluded" }], "carry")).toHaveLength(0);
  });
  it("never substitutes final offline for carry-side", () => {
    const s = { ...shot, total_m: 170, total_side_m: -12 };
    expect(side(s, "carry", "m")).toBeNull();
    expect(side(s, "total", "m")).toBe(-12);
  });
});
describe("Descriptive math", () => {
  it("matches independently calculated linear percentiles and keeps mishits", () => {
    expect(quantile([0, 100, 120, 140, 160], 0.5)).toBe(120);
    expect(quantile([0, 100, 120, 140, 160], 0.1)).toBe(40);
    expect(quantile([0, 100, 120, 140, 160], 0.9)).toBe(152);
    expect(quantile([], 0.5)).toBeNull();
  });
  it("suppresses small or singular ellipses", () => {
    expect(ellipse([[1, 2]], 0.8)).toBeNull();
    expect(
      ellipse(
        Array.from({ length: 12 }, (_, i) => [i, 2 * i]),
        0.8,
      ),
    ).toBeNull();
  });
  it("recovers an analytic ellipse, including tied boundary shots", () => {
    const points = Array.from({ length: 12 }, (_, i): [number, number] => [
      3 + 10 * Math.cos((i * Math.PI) / 6),
      140 + 20 * Math.sin((i * Math.PI) / 6),
    ]);
    const e = ellipse(points, 0.8)!;
    expect(e.enclosed).toBe(12);
    expect(Math.min(...e.points.map((p) => p[0]))).toBeCloseTo(-7);
    expect(Math.max(...e.points.map((p) => p[1]))).toBeCloseTo(160);
  });
});

describe("Explorer display membership and order", () => {
  it("uses conventional bag order, including wedge aliases and lofts", () => {
    const labels = [
      "LW",
      "7 iron",
      "3 wood",
      "Driver",
      "SW",
      "5 hybrid",
      "PW",
      "GW",
      "9 iron",
      "58°",
      "52 degree",
      "putter",
    ];
    expect(labels.sort((a, b) => clubOrder(a) - clubOrder(b))).toEqual([
      "Driver",
      "3 wood",
      "5 hybrid",
      "7 iron",
      "9 iron",
      "PW",
      "GW",
      "52 degree",
      "SW",
      "58°",
      "LW",
      "putter",
    ]);
    expect(clubOrder("7i")).toBe(clubOrder("7-iron"));
    expect(clubOrder("3W")).toBe(clubOrder("3 wood"));
  });
  it("keeps the same club type adjacent across sets in cards and distance axes", () => {
    const clubs = [
      { ...shot, club_id: "b-7", set_id: "b" },
      { ...shot, club_label: "Driver", club_id: "a-d" },
      shot,
    ];
    expect(clubs.sort(compareClubs).map((s) => s.club_id)).toEqual([
      "a-d",
      "a-7",
      "b-7",
    ]);
    expect(groups(clubs, "carry").map(([, rows]) => rows[0].club_id)).toEqual([
      "a-d",
      "a-7",
      "b-7",
    ]);
  });
  it("builds legends only from eligible plotted shots, never missing or flagged rows", () => {
    const shots = [
      shot,
      { ...shot, shot_id: "2", carry_side_m: 0, total_m: 150, total_side_m: 2 },
      {
        ...shot,
        shot_id: "3",
        carry_side_m: 1,
        quality: "excluded" as const,
        exclusion_reason: "measurement error",
      },
    ];
    expect(
      plottedShots(shots, "carry", "dispersion").map((s) => s.shot_id),
    ).toEqual(["2"]);
    expect(
      plottedShots(shots, "carry", "distance").map((s) => s.shot_id),
    ).toEqual(["1", "2"]);
    expect(
      plottedShots(shots, "total", "dispersion").map((s) => s.shot_id),
    ).toEqual(["2"]);
    expect(plottedShots([shot], "total", "dispersion")).toEqual([]);
  });
  it("assigns set badges their own distinct colors", () => {
    expect(setColor("set-a")).not.toBe(setColor("set-b"));
    expect(setColor("set-a")).toBe("#52734d");
    expect(color("set-b", ["set-a", "set-b"])).toBe(setColor("set-b"));
  });
});

describe("overhead geometry", () => {
  const radial: Shot = {
    ...shot,
    source: "trackman",
    total_m: 182.88,
    total_side_m: 18.288,
  };
  it("preserves radial distance while converting to forward position", () => {
    const p = overheadPoint(radial, "total", "yd")!;
    expect(p[0]).toBeCloseTo(20);
    expect(p[1]).toBeCloseTo(Math.sqrt(200 ** 2 - 20 ** 2));
    expect(Math.hypot(...p)).toBeCloseTo(200);
    expect(
      overheadPoint({ ...radial, total_side_m: -18.288 }, "total", "yd")![1],
    ).toBeCloseTo(p[1]);
    expect(overheadPoint(radial, "total", "m")![1]).toBeCloseTo(p[1] * 0.9144);
  });
  it("includes reviewed Toptracer totals automatically, without inferring carry positions", () => {
    const tt = { ...radial, source: "toptracer" as const };
    expect(overheadPoint(tt, "total", "yd")).toEqual(
      overheadPoint(radial, "total", "yd"),
    );
    expect(overheadPoint(tt, "carry", "yd")).toBeNull();
    expect(
      overheadPoint({ ...tt, carry_m: 100, carry_side_m: 10 }, "carry", "yd"),
    ).toBeNull();
    expect(
      overheadPoint({ ...tt, total_side_m: null }, "total", "yd"),
    ).toBeNull();
    expect(overheadPoint({ ...tt, total_side_m: 0 }, "total", "m")).toEqual([
      0,
      tt.total_m,
    ]);
    expect(
      overheadPoint({ ...radial, source: "manual" }, "total", "yd"),
    ).toBeNull();
    expect(
      overheadPoint({ ...radial, total_side_m: 190 }, "total", "yd"),
    ).toBeNull();
    expect(
      plottedShots([radial, { ...tt, shot_id: "2" }], "total", "overhead"),
    ).toHaveLength(2);
  });
  it("uses equal units per pixel at desktop and narrow widths", () => {
    for (const width of [240, 700]) {
      const b = overheadBounds(width, 360, 120, 250);
      expect(b.x).toBeGreaterThanOrEqual(120);
      expect(b.y).toBeGreaterThanOrEqual(250);
      expect((2 * b.x) / width).toBeCloseTo(b.y / 360);
    }
  });
});

it("uses explicit synthetic total geometry without assuming manual carry geometry", () => {
  const radial = {
    ...shot,
    total_m: 100,
    total_side_m: 20,
    carry_side_m: 10,
    total_distance_geometry: "radial" as const,
  };
  const validated = parseSnapshot({
    kind: "club-picker-explorer",
    version: 1,
    distance_unit: "m",
    shots: [radial],
  }).shots[0];
  expect(overheadPoint(validated, "total", "m")).toEqual([20, Math.sqrt(9600)]);
  expect(overheadPoint(validated, "carry", "m")).toBeNull();
  expect(
    overheadPoint(
      { ...validated, total_distance_geometry: "unknown" },
      "total",
      "m",
    ),
  ).toBeNull();
});
