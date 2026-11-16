import type { CSSProperties } from "react";
import type { Unit } from "./data";

export function SpreadChange({ delta, unit }: { delta: number; unit: Unit }) {
  if (Number(delta.toFixed(1)) === 0)
    return <span className="spread-unchanged">Same width</span>;
  const direction = delta < 0 ? "narrower" : "wider";
  const yards = Math.abs(delta) / (unit === "m" ? 0.9144 : 1);
  const intensity = Math.min(yards / 10, 1);
  return (
    <span
      className={`spread-change spread-${direction}`}
      style={{ "--spread-strength": `${intensity * 100}%` } as CSSProperties}
    >
      {Math.abs(delta).toFixed(1)} {unit} {direction}
    </span>
  );
}
