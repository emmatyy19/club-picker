import { z } from "zod";

const positive = z.number().finite().positive();
const distance = z.number().finite().nonnegative();
const club = z
  .object({ id: z.string().min(1), label: z.string().min(1) })
  .strict();
export const planSchema = z
  .object({
    version: z.literal("finish-baseline-v1"),
    set: z.string().min(1),
    context: z.string(),
    targetM: positive,
    measuredM: positive,
    playsLikeM: positive.nullable(),
    angle: z.number().finite().gt(-90).lt(90).nullable(),
    mustCarryM: positive.nullable(),
    window: z
      .object({ front: positive, back: positive })
      .strict()
      .refine((v) => v.front < v.back)
      .nullable(),
    suggested: club,
    intent: z.enum(["full", "partial", "unknown"]),
    carryM: distance,
    totalM: distance.nullable(),
    lowM: distance,
    highM: distance,
    shots: z.number().int().positive(),
    dates: z.number().int().nonnegative(),
    clears: z.number().min(0).max(1).nullable(),
    fits: z.number().min(0).max(1).nullable(),
  })
  .strict();
export type FeedbackPlan = z.infer<typeof planSchema>;
const resultSchema = z
  .object({
    finish: z.enum(["unknown", "short", "on", "long"]),
    side: z.enum(["unknown", "left", "center", "right"]),
    hazard: z.enum(["unknown", "none", "bunker", "water", "other"]),
  })
  .strict()
  .refine(
    (v) => Object.values(v).some((x) => x !== "unknown"),
    "Record at least one outcome.",
  );
const entrySchema = z
  .object({
    id: z.string().min(1),
    savedAt: z.string().datetime(),
    plan: planSchema,
    played: club,
    swing: z.enum(["full", "partial"]),
    result: resultSchema.nullable(),
  })
  .strict();
const logSchema = z
  .object({
    kind: z.literal("my-caddie-private-feedback"),
    version: z.literal(1),
    entries: z.array(entrySchema).max(10000),
  })
  .strict()
  .refine(
    (v) => new Set(v.entries.map((e) => e.id)).size === v.entries.length,
    "Duplicate log entries.",
  );
export type FeedbackEntry = z.infer<typeof entrySchema>;
export type FeedbackResult = z.infer<typeof resultSchema>;
export const feedbackKey =
  import.meta.env.MODE === "phone"
    ? `my-caddie.device-feedback.v1:${import.meta.env.BASE_URL}`
    : "my-caddie.private-feedback.v1";
export function parseFeedback(value: unknown): FeedbackEntry[] {
  return logSchema.parse(value).entries;
}
export function serializeFeedback(entries: FeedbackEntry[]): string {
  const log = { kind: "my-caddie-private-feedback", version: 1, entries };
  logSchema.parse(log);
  return JSON.stringify(log, null, 2);
}
/** Capture the recommendation now, independently of later library updates. */
export function makeFeedback(
  plan: FeedbackPlan,
  played: { id: string; label: string },
  swing: "full" | "partial",
): FeedbackEntry {
  return entrySchema.parse({
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    plan,
    played,
    swing,
    result: null,
  });
}
export function recordResult(
  entries: FeedbackEntry[],
  id: string,
  result: FeedbackResult,
): FeedbackEntry[] {
  const checked = resultSchema.parse(result);
  if (!entries.some((e) => e.id === id))
    throw Error("Saved shot was not found.");
  return entries.map((e) => (e.id === id ? { ...e, result: checked } : e));
}
