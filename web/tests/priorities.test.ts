import { expect, it } from "vitest";
import { practicePriorities } from "../src/priorities";
import { shot } from "./fixtures";
const rows = () =>
  Array.from({ length: 30 }, (_, i) => ({
    ...shot,
    shot_id: String(i),
    session_date: `2026-01-0${Math.floor(i / 10) + 1}`,
    carry_m: 100,
    total_side_m: 10,
    total_m: 110,
  }));
it("requires repeat dates and keeps different clubs and contexts separate", () => {
  expect(practicePriorities(rows().slice(0, 20)).findings).toEqual([]);
  expect(
    practicePriorities(
      rows().map((s, i) => ({ ...s, club_id: i < 20 ? "a" : "b" })),
    ).findings,
  ).toEqual([]);
  expect(
    practicePriorities(
      rows().map((s, i) => ({
        ...s,
        normalization: i < 20 ? "normalized" : "unknown",
      })),
    ).findings,
  ).toEqual([]);
  expect(practicePriorities(rows()).findings).toMatchObject([
    { kind: "right", hits: 3 },
  ]);
});
it("distinguishes watch from repeated and does not treat missing side as zero", () => {
  expect(
    practicePriorities(
      rows().map((s, i) => ({ ...s, total_side_m: i < 20 ? 10 : 0 })),
    ).findings,
  ).toMatchObject([{ hits: 2 }]);
  expect(
    practicePriorities(rows().map((s) => ({ ...s, total_side_m: null })))
      .findings,
  ).toEqual([]);
  expect(
    practicePriorities(rows().map((s) => ({ ...s, quality: "excluded" })))
      .supported,
  ).toBe(0);
});
it("keeps short mishits, uses latest dates and ignores isolated bad dates", () => {
  const data = rows().map((s, i) => ({
    ...s,
    total_side_m: 0,
    carry_m: i % 10 < 3 ? 50 : 100,
  }));
  expect(practicePriorities(data).findings.map((f) => f.kind)).toContain(
    "short",
  );
  const later = rows().map((s) => ({
    ...s,
    session_date: s.session_date!.replace("01-", "02-"),
    total_side_m: 0,
  }));
  expect(practicePriorities([...data, ...later]).findings).toEqual([]);
});
it("retains measurements below the alert threshold for review", () => {
  const result = practicePriorities(
    rows().map((s) => ({ ...s, total_side_m: 0 })),
  );
  expect(result.findings).toEqual([]);
  expect(
    result.observations.find((f) => f.kind === "width")?.dates,
  ).toHaveLength(3);
  expect(result.observations.every((f) => f.hits === 0)).toBe(true);
});

it("does not report zero-median carry as perfect consistency", () => {
  const result = practicePriorities(rows().map((s) => ({ ...s, carry_m: 0 })));
  expect(
    result.observations.some((f) => f.kind === "width" || f.kind === "short"),
  ).toBe(false);
  expect(result.observations.find((f) => f.kind === "right")?.hits).toBe(3);
});
