import { describe, expect, it } from "vitest";
import { filterShots, emptyFilters } from "../src/data";
import {
  initialPlayback,
  playbackDates,
  playbackReducer,
} from "../src/playback";
import { shot } from "./fixtures";
const dates = ["2026-01-01", "2026-02-03", "2026-04-10"];

describe("Date playback", () => {
  it("uses chronological actual dates from the selected data, once per day across providers", () => {
    const rows = [
      { ...shot, session_date: dates[2] },
      { ...shot, session_date: dates[0] },
      { ...shot, session_date: dates[0], source: "trackman" as const },
      { ...shot, session_date: dates[1], club_label: "6 iron", club_id: "a-6" },
      { ...shot, session_date: null },
      { ...shot, session_date: "2025-01-01", quality: "excluded" as const },
    ];
    expect(playbackDates(rows)).toEqual(dates);
    expect(
      playbackDates(
        filterShots(rows, {
          ...emptyFilters,
          tags: [{ field: "club_label", value: "7 iron" }],
          start: dates[1],
        }),
      ),
    ).toEqual([dates[2]]);
  });
  it("starts at the first date, pauses without losing the frame, and resumes until the end", () => {
    let state = playbackReducer(initialPlayback, { type: "play", dates });
    expect(state).toEqual({ date: dates[0], playing: true });
    state = playbackReducer(state, { type: "tick", dates });
    expect(state.date).toBe(dates[1]);
    state = playbackReducer(state, { type: "pause" });
    expect(playbackReducer(state, { type: "tick", dates })).toEqual(state);
    state = playbackReducer(state, { type: "play", dates });
    state = playbackReducer(state, { type: "tick", dates });
    expect(state).toEqual({ date: dates[2], playing: false });
    expect(playbackReducer(state, { type: "play", dates }).date).toBe(dates[0]);
  });
  it("steps without playing and stays within bounds; reset returns to the full selection", () => {
    let state = playbackReducer(initialPlayback, {
      type: "step",
      dates,
      direction: -1,
    });
    expect(state).toEqual({ date: dates[2], playing: false });
    expect(
      playbackReducer(state, { type: "step", dates, direction: 1 }),
    ).toEqual(state);
    state = playbackReducer(state, { type: "step", dates, direction: -1 });
    expect(state.date).toBe(dates[1]);
    expect(playbackReducer(state, { type: "reset" })).toEqual(initialPlayback);
    expect(
      playbackReducer(initialPlayback, { type: "step", dates, direction: 1 })
        .date,
    ).toBe(dates[0]);
  });
  it("handles empty, single-date and obsolete frames without an endless timer", () => {
    expect(
      playbackReducer(initialPlayback, { type: "play", dates: [] }),
    ).toEqual(initialPlayback);
    expect(
      playbackReducer(initialPlayback, {
        type: "play",
        dates: dates.slice(0, 1),
      }),
    ).toEqual({ date: dates[0], playing: false });
    expect(
      playbackReducer(
        { date: "2025-01-01", playing: false },
        { type: "play", dates },
      ).date,
    ).toBe(dates[0]);
  });
});
