import { clubOrder, groupKey, sessionKey, type Shot, type Unit } from "./data";

export type CarrySummary = {
  low: number;
  median: number;
  high: number;
  shots: number;
  sessions: number;
};
/** Equal mass per session, then equal mass per shot within each session. */
export function summarizeCarry(sessions: number[][]): CarrySummary {
  if (
    !sessions.length ||
    sessions.some(
      (s) => !s.length || s.some((v) => !Number.isFinite(v) || v < 0),
    )
  )
    throw Error("Carry sessions must contain finite, nonnegative distances.");
  const points = sessions
    .flatMap((s) =>
      s.map((value) => ({ value, weight: 1 / sessions.length / s.length })),
    )
    .sort((a, b) => a.value - b.value);
  const q = (p: number) => {
    let mass = 0;
    for (let i = 0; i < points.length; i++) {
      mass += points[i].weight;
      if (Math.abs(mass - p) < 1e-10)
        return (
          (points[i].value + (points[i + 1]?.value ?? points[i].value)) / 2
        );
      if (mass > p) return points[i].value;
    }
    return points[points.length - 1].value;
  };
  return {
    low: q(0.1),
    median: q(0.5),
    high: q(0.9),
    shots: points.length,
    sessions: sessions.length,
  };
}
export function approachTarget(
  distance: number,
  playsLike: number | null,
  angle: number | null,
  unit: Unit,
): number {
  if (
    ![distance, ...(playsLike === null ? [] : [playsLike])].every(
      (v) => Number.isFinite(v) && v > 0,
    )
  )
    throw Error("Enter a distance greater than zero.");
  if (angle !== null && (!Number.isFinite(angle) || Math.abs(angle) >= 90))
    throw Error("Slope angle must be between −90° and 90°.");
  return (playsLike ?? distance) * (unit === "yd" ? 0.9144 : 1);
}
export function approachContext(s: Shot): string {
  return JSON.stringify([
    ...JSON.parse(groupKey(s, "carry")).slice(1),
    s.total_basis,
  ]);
}
export function approachEligible(s: Shot): boolean {
  return (
    s.quality === "usable" &&
    clubOrder(s.club_label) > 0 &&
    clubOrder(s.club_label) < 200 &&
    !/putter/i.test(s.club_label) &&
    ["full", "partial", "unknown"].includes(s.intent)
  );
}
export type ApproachProfile = CarrySummary & {
  club: Shot;
  latest: string | null;
  carrySessions: number[][];
  total: CarrySummary | null;
};
export function approachProfiles(
  shots: Shot[],
  set: string,
  context: string,
): ApproachProfile[] {
  const clubs = new Map<string, Shot[]>();
  for (const s of shots) {
    if (
      !approachEligible(s) ||
      s.set_id !== set ||
      approachContext(s) !== context
    )
      continue;
    clubs.set(s.club_id, [...(clubs.get(s.club_id) ?? []), s]);
  }
  return [...clubs.values()].map((rows) => {
    const sessions = new Map<string, number[]>();
    for (const s of rows)
      sessions.set(sessionKey(s), [
        ...(sessions.get(sessionKey(s)) ?? []),
        s.carry_m,
      ]);
    const totalSessions = new Map<string, number[]>();
    for (const s of rows)
      if (s.total_m !== null)
        totalSessions.set(sessionKey(s), [
          ...(totalSessions.get(sessionKey(s)) ?? []),
          s.total_m,
        ]);
    const dates = rows
      .flatMap((s) => (s.session_date ? [s.session_date] : []))
      .sort();
    return {
      ...summarizeCarry([...sessions.values()]),
      carrySessions: [...sessions.values()],
      total: totalSessions.size
        ? summarizeCarry([...totalSessions.values()])
        : null,
      club: rows[0],
      latest: dates.at(-1) ?? null,
    };
  });
}
export function rankApproaches(
  profiles: ApproachProfile[],
  targetM: number,
  window: CarryWindow | null = null,
) {
  if (!Number.isFinite(targetM) || targetM <= 0)
    throw Error("Invalid target carry.");
  return profiles
    .map((p) => ({
      ...p,
      gap: p.median - targetM,
      outcomes: window ? windowOutcomes(p.carrySessions, window) : null,
    }))
    .sort(
      (a, b) =>
        (b.outcomes?.within ?? 0) - (a.outcomes?.within ?? 0) ||
        Math.abs(a.gap) - Math.abs(b.gap) ||
        clubOrder(a.club.club_label) - clubOrder(b.club.club_label) ||
        a.club.club_id.localeCompare(b.club.club_id),
    );
}

export type CarryWindow = { front: number; back: number };
export function carryWindow(
  front: number,
  back: number,
  unit: Unit,
): CarryWindow {
  if (![front, back].every((v) => Number.isFinite(v) && v > 0) || front >= back)
    throw Error("Front must be greater than zero and shorter than back.");
  const scale = unit === "yd" ? 0.9144 : 1;
  return { front: front * scale, back: back * scale };
}
/** Historical frequencies with equal session weight, inclusive window edges. */
export function windowOutcomes(sessions: number[][], window: CarryWindow) {
  carryWindow(window.front, window.back, "m");
  summarizeCarry(sessions); // Validate the observations at the calculation boundary.
  let short = 0,
    within = 0,
    long = 0;
  for (const session of sessions)
    for (const carry of session) {
      const weight = 1 / sessions.length / session.length;
      if (carry < window.front - 1e-9) short += weight;
      else if (carry > window.back + 1e-9) long += weight;
      else within += weight;
    }
  return { short, within, long };
}

/** Descriptive ranking: joint carry fit with a landing window, clearance otherwise, then reported finish. */
export function rankFinishApproaches(
  profiles: ApproachProfile[],
  targetM: number,
  window: CarryWindow | null = null,
  mustCarryM: number | null = null,
) {
  if (!Number.isFinite(targetM) || targetM <= 0)
    throw Error("Invalid finish distance.");
  if (mustCarryM !== null && (!Number.isFinite(mustCarryM) || mustCarryM <= 0))
    throw Error("Must carry must be greater than zero.");
  return profiles
    .map((p) => {
      let clears: number | null = null;
      if (mustCarryM !== null)
        clears =
          p.carrySessions.reduce(
            (sum, session) =>
              sum +
              session.filter((v) => v > mustCarryM + 1e-9).length /
                session.length,
            0,
          ) / p.carrySessions.length;
      return {
        ...p,
        gap: p.total === null ? null : p.total.median - targetM,
        fits: window
          ? p.carrySessions.reduce(
              (sum, session) =>
                sum +
                session.filter(
                  (v) =>
                    v >= window.front - 1e-9 &&
                    v <= window.back + 1e-9 &&
                    (mustCarryM === null || v > mustCarryM + 1e-9),
                ).length /
                  session.length,
              0,
            ) / p.carrySessions.length
          : null,
        clears,
        outcomes: window ? windowOutcomes(p.carrySessions, window) : null,
      };
    })
    .sort(
      (a, b) =>
        (window
          ? (b.fits ?? 0) - (a.fits ?? 0)
          : (b.clears ?? 0) - (a.clears ?? 0)) ||
        (a.gap === null ? Infinity : Math.abs(a.gap)) -
          (b.gap === null ? Infinity : Math.abs(b.gap)) ||
        clubOrder(a.club.club_label) - clubOrder(b.club.club_label) ||
        a.club.club_id.localeCompare(b.club.club_id),
    );
}
