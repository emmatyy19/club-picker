import { describe, expect, it } from "vitest";
import {
  makeFeedback,
  parseFeedback,
  recordResult,
  serializeFeedback,
  type FeedbackPlan,
} from "../src/feedback";
const plan: FeedbackPlan = {
  version: "finish-baseline-v1",
  set: "a",
  context: "invented",
  targetM: 140,
  measuredM: 145,
  playsLikeM: 140,
  angle: -2,
  mustCarryM: 100,
  window: { front: 120, back: 150 },
  suggested: { id: "a7", label: "7 iron" },
  intent: "unknown",
  carryM: 125,
  totalM: 140,
  lowM: 110,
  highM: 135,
  shots: 40,
  dates: 4,
  clears: 1,
  fits: 0.7,
};
describe("private feedback", () => {
  it("freezes the pre-shot suggestion and separates the played club and post-shot outcome", () => {
    const input = structuredClone(plan);
    const entry = makeFeedback(input, { id: "a6", label: "6 iron" }, "partial");
    input.carryM = 999;
    input.suggested.label = "changed";
    expect(entry.plan.carryM).toBe(125);
    expect(entry.plan.suggested.label).toBe("7 iron");
    expect(entry.played.id).toBe("a6");
    expect(entry.result).toBeNull();
    const updated = recordResult([entry], entry.id, {
      finish: "short",
      side: "right",
      hazard: "water",
    });
    expect(updated[0].plan).toEqual(entry.plan);
    expect(entry.result).toBeNull();
    expect(parseFeedback(JSON.parse(serializeFeedback(updated)))).toEqual(
      updated,
    );
  });
  it("rejects invalid backup data and unknown-only outcomes", () => {
    const entry = makeFeedback(plan, plan.suggested, "full");
    expect(() =>
      recordResult([entry], entry.id, {
        finish: "unknown",
        side: "unknown",
        hazard: "unknown",
      }),
    ).toThrow();
    expect(() =>
      recordResult([entry], "missing", {
        finish: "short",
        side: "unknown",
        hazard: "unknown",
      }),
    ).toThrow();
    expect(() => serializeFeedback([entry, entry])).toThrow();
    expect(() =>
      parseFeedback({
        kind: "my-caddie-private-feedback",
        version: 2,
        entries: [],
      }),
    ).toThrow();
    expect(() =>
      makeFeedback({ ...plan, targetM: NaN }, plan.suggested, "full"),
    ).toThrow();
    expect(() =>
      makeFeedback(
        { ...plan, window: { front: 150, back: 100 } },
        plan.suggested,
        "full",
      ),
    ).toThrow();
  });
});

it("round-trips pooled plans while still accepting older single-context plans", () => {
  for (const version of [
    "finish-baseline-v1",
    "finish-baseline-v2-pooled",
  ] as const) {
    const entry = makeFeedback(
      { ...plan, version },
      { id: "a7", label: "7 iron" },
      "full",
    );
    expect(
      parseFeedback(JSON.parse(serializeFeedback([entry])))[0].plan.version,
    ).toBe(version);
  }
});
