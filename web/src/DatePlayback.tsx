import { useEffect, useReducer, useState } from "react";
import { Button } from "@mantine/core";
import { initialPlayback, playbackReducer } from "./playback";

export function useDatePlayback(dates: string[], contextKey: string) {
  const [state, dispatch] = useReducer(playbackReducer, initialPlayback);
  const [speed, setSpeed] = useState("2000");
  useEffect(() => dispatch({ type: "reset" }), [contextKey]);
  useEffect(() => {
    if (!state.playing) return;
    const timer = window.setInterval(
      () => dispatch({ type: "tick", dates }),
      Number(speed),
    );
    return () => window.clearInterval(timer);
  }, [state.playing, dates, speed]);
  return { dates, state, dispatch, speed, setSpeed };
}

export function Playback({
  controller,
}: {
  controller: ReturnType<typeof useDatePlayback>;
}) {
  const { dates, state, dispatch } = controller;
  const index = state.date === null ? -1 : dates.indexOf(state.date);
  return (
    <div className="playback-controls" aria-label="Date playback">
      <Button
        className="playback-toggle"
        size="xs"
        variant="light"
        disabled={!dates.length}
        onClick={() =>
          dispatch(state.playing ? { type: "pause" } : { type: "play", dates })
        }
      >
        <span aria-hidden="true">{state.playing ? "Ⅱ" : "▶"}</span>{" "}
        {state.playing ? "Pause" : "Play dates"}
      </Button>
      <Button
        className="playback-step"
        size="xs"
        variant="default"
        aria-label="Previous date"
        disabled={!dates.length || index === 0}
        onClick={() => dispatch({ type: "step", dates, direction: -1 })}
      >
        ←
      </Button>
      <Button
        className="playback-step"
        size="xs"
        variant="default"
        aria-label="Next date"
        disabled={!dates.length || index === dates.length - 1}
        onClick={() => dispatch({ type: "step", dates, direction: 1 })}
      >
        →
      </Button>
      <span className="playback-status" role="status">
        {index >= 0
          ? `${state.date} · ${index + 1}/${dates.length}`
          : `${dates.length} selected ${dates.length === 1 ? "date" : "dates"}`}
      </span>
      <Button
        className="playback-reset"
        size="xs"
        variant="default"
        disabled={state.date === null}
        aria-label="Show all selected dates"
        onClick={() => dispatch({ type: "reset" })}
      >
        All dates
      </Button>
    </div>
  );
}
