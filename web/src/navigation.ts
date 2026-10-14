export type Viewport = { x: number; y: number; scale: number };
export const fullView: Viewport = { x: 0.5, y: 0.5, scale: 1 };
const clamp = (v: number, scale: number) =>
  Math.min(1 - scale / 2, Math.max(scale / 2, v));
export function zoomViewport(
  v: Viewport,
  factor: number,
  x = 0.5,
  y = 0.5,
): Viewport {
  const scale = Math.max(0.05, Math.min(1, v.scale * factor));
  return {
    scale,
    x: clamp(v.x + (x - 0.5) * (v.scale - scale), scale),
    y: clamp(v.y + (y - 0.5) * (v.scale - scale), scale),
  };
}
export function panViewport(v: Viewport, dx: number, dy: number): Viewport {
  return {
    ...v,
    x: clamp(v.x + dx * v.scale, v.scale),
    y: clamp(v.y + dy * v.scale, v.scale),
  };
}
