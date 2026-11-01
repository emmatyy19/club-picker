import { useEffect, useReducer, useState } from "react";
import { Button, Select } from "@mantine/core";
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
      <div className="playback-transport">
        <Button
          className="playback-toggle"
          size="xs"
          variant="light"
          disabled={!dates.length}
          onClick={() =>
            dispatch(
              state.playing ? { type: "pause" } : { type: "play", dates },
            )
          }
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            fill="currentColor"
          >
            {state.playing ? (
              <path d="M2 1h3v10H2zm5 0h3v10H7z" />
            ) : (
              <path d="M2 1l9 5-9 5z" />
            )}
          </svg>{" "}
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
      </div>
      <div className="playback-meta">
        <Select
          aria-label="Playback speed"
          size="xs"
          value={controller.speed}
          onChange={(value) => value && controller.setSpeed(value)}
          data={[
            { value: "1000", label: "1 sec" },
            { value: "2000", label: "2 sec" },
            { value: "4000", label: "4 sec" },
          ]}
        />
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
    </div>
  );
}
