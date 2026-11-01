export function ChartTouchControl({
  active,
  onChange,
}: {
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <>
      <button
        className="chart-touch-toggle"
        aria-pressed={active}
        onClick={() => onChange(!active)}
      >
        {active ? "Done exploring" : "Explore chart"}
      </button>
      <span className="chart-touch-hint" role="status">
        {active
          ? "Drag to pan · Pinch to zoom · Done to scroll page"
          : "Explore chart to drag & pinch"}
      </span>
    </>
  );
}
