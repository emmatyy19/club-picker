import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { loadLibrary, loadRepoLibrary, saveLibrary } from "../src/storage";
import { parseSnapshot } from "../src/data";
import { shot, snapshot } from "./fixtures";
let saved: Map<string, string>;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("persists and revalidates a restored library", () => {
  expect(loadLibrary()).toBeNull();
  const data = parseSnapshot(snapshot([shot]));
  saveLibrary(data);
  expect(loadLibrary()).toEqual(data);
});
it("surfaces quota and corrupt-storage errors instead of claiming a save", () => {
  saved.set("club-picker.library.v1", "broken");
  expect(() => loadLibrary()).toThrow();
  vi.stubGlobal("localStorage", {
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  });
  expect(() => saveLibrary(parseSnapshot(snapshot([shot])))).toThrow(
    "QuotaExceededError",
  );
});
it("does not replace a valid library with an invalid snapshot", () => {
  const data = parseSnapshot(snapshot([shot]));
  saveLibrary(data);
  expect(() =>
    saveLibrary({ ...data, shots: [{ ...shot, total_side_m: 1 }] }),
  ).toThrow();
  expect(loadLibrary()).toEqual(data);
});

it("reads updated repo data without consulting or overwriting a browser backup", async () => {
  const old = parseSnapshot(snapshot([shot]));
  saveLibrary(old);
  const updated = parseSnapshot(snapshot([{ ...shot, shot_id: "new-shot" }]));
  const fetcher = vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => updated });
  vi.stubGlobal("fetch", fetcher);
  expect(await loadRepoLibrary()).toEqual(updated);
  expect(loadLibrary()).toEqual(old);
  expect(fetcher).toHaveBeenCalledWith("/__local_snapshot", {
    cache: "no-store",
  });
});
it("distinguishes missing repo data from failed or invalid reads", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ status: 204 })
    .mockResolvedValueOnce({ status: 500, ok: false })
    .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
    .mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetcher);
  expect(await loadRepoLibrary()).toBeNull();
  await expect(loadRepoLibrary()).rejects.toThrow();
  await expect(loadRepoLibrary()).rejects.toThrow();
  await expect(loadRepoLibrary()).rejects.toThrow("offline");
});

it("showcase mode uses only validated synthetic data without fetching private data", async () => {
  saveLibrary(parseSnapshot(snapshot([shot])));
  vi.stubEnv("MODE", "showcase");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(loadLibrary()).toBeNull();
  const demo = await loadRepoLibrary();
  expect(demo?.shots.length).toBe(1320);
  expect(
    demo?.shots.every(
      (s) =>
        s.shot_id.startsWith("synthetic-") &&
        s.session_date?.startsWith("2030-") &&
        s.source === "manual",
    ),
  ).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});

it("showcase cannot overwrite a personal library already stored on the origin", () => {
  const personal = parseSnapshot(snapshot([shot]));
  saveLibrary(personal);
  vi.stubEnv("MODE", "showcase");
  expect(() => saveLibrary(personal)).toThrow(
    "Personal libraries cannot be saved",
  );
  expect(loadLibrary()).toBeNull();
  vi.stubEnv("MODE", "production");
  expect(loadLibrary()).toEqual(personal);
});

it("phone build isolates imported data and never requests the private repo endpoint", async () => {
  const personal = parseSnapshot(snapshot([shot]));
  saveLibrary(personal);
  vi.stubEnv("MODE", "phone");
  vi.resetModules();
  const phone = await import("../src/storage");
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  expect(phone.loadLibrary()).toBeNull();
  expect((await phone.loadRepoLibrary())?.shots.length).toBe(1320);
  phone.saveLibrary(
    parseSnapshot(snapshot([{ ...shot, shot_id: "phone-only" }])),
  );
  expect(phone.loadLibrary()?.shots[0].shot_id).toBe("phone-only");
  expect(loadLibrary()).toEqual(personal);
  expect(fetcher).not.toHaveBeenCalled();
});
