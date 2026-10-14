import type { Shot } from "./data";

export function playbackDates(shots: Shot[]): string[] {
  return [
    ...new Set(
      shots
        .filter((s) => s.quality === "usable" && s.session_date !== null)
        .map((s) => s.session_date!),
    ),
  ].sort();
}
export type PlaybackState = { date: string | null; playing: boolean };
export const initialPlayback: PlaybackState = { date: null, playing: false };
export type PlaybackAction =
  | { type: "reset" }
  | { type: "pause" }
  | { type: "play" | "tick"; dates: string[] }
  | { type: "step"; dates: string[]; direction: -1 | 1 };

/** Advance among actual dates, without changing the user's saved filters. */
export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  if (action.type === "reset") return initialPlayback;
  if (action.type === "pause") return { ...state, playing: false };
  const dates = action.dates;
  if (!dates.length) return initialPlayback;
  const index = state.date === null ? -1 : dates.indexOf(state.date);
  if (action.type === "play") {
    const restart = index < 0 || index === dates.length - 1;
    return { date: dates[restart ? 0 : index], playing: dates.length > 1 };
  }
  if (action.type === "step") {
    const next =
      index < 0
        ? action.direction === 1
          ? 0
          : dates.length - 1
        : Math.max(0, Math.min(dates.length - 1, index + action.direction));
    return { date: dates[next], playing: false };
  }
  if (!state.playing) return state;
  const next = Math.min(dates.length - 1, Math.max(0, index + 1));
  return { date: dates[next], playing: next < dates.length - 1 };
}
