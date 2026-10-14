import { expect, it } from "vitest";
import { fullView, panViewport, zoomViewport } from "../src/navigation";

it("zooms around the pointed data position and keeps axes at one scale", () => {
  const next = zoomViewport(fullView, 0.5, 0.7, 0.8);
  expect(next.scale).toBe(0.5);
  expect(next.x + (0.7 - 0.5) * next.scale).toBeCloseTo(0.7);
  expect(next.y + (0.8 - 0.5) * next.scale).toBeCloseTo(0.8);
});
it("pans within the data extent and can focus above zero", () => {
  const zoomed = zoomViewport(fullView, 0.5);
  const moved = panViewport(zoomed, 0.1, 0.5);
  expect(moved.y - moved.scale / 2).toBe(0.5);
  expect(moved.x).toBeCloseTo(0.55);
  expect(panViewport(zoomed, 100, -100)).toEqual({
    x: 0.75,
    y: 0.25,
    scale: 0.5,
  });
});
it("limits zoom and restores the full extent on zoom-out", () => {
  expect(zoomViewport(fullView, 0.001).scale).toBe(0.05);
  expect(zoomViewport({ x: 0.8, y: 0.7, scale: 0.2 }, 10)).toEqual(fullView);
});
