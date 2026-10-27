import { expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { offlinePlugin } from "../offline-plugin";

it("caches only bundled files under the app scope and serves offline home navigation", async () => {
  const root = await mkdtemp(join(tmpdir(), "caddie-offline-"));
  try {
    await writeFile(join(root, "index.html"), "<head></head><body>test</body>");
    await writeFile(join(root, "app.js"), "test");
    await writeFile(join(root, "bunny-caddie.svg"), "<svg/>");
    const plugin = offlinePlugin();
    (plugin.configResolved as (c: unknown) => void)({
      mode: "phone",
      root,
      build: { outDir: "." },
    });
    await (plugin.closeBundle as () => Promise<void>)();
    const events: Record<string, (e: any) => void> = {};
    const urls: string[] = [];
    runInNewContext(await readFile(join(root, "sw.js"), "utf8"), {
      URL,
      self: {
        registration: { scope: "https://example.test/club-picker/" },
        addEventListener: (name: string, fn: (e: any) => void) => {
          events[name] = fn;
        },
      },
      caches: {
        open: async () => ({
          addAll: async (paths: string[]) => {
            urls.push(...paths);
          },
          match: async (key: string) => `cached:${key}`,
        }),
      },
      fetch: () => {
        throw Error("Unexpected network request");
      },
    });
    let work: Promise<unknown> | undefined;
    events.install({
      waitUntil: (p: Promise<unknown>) => {
        work = p;
      },
    });
    await work;
    expect(urls).toContain("https://example.test/club-picker/app.js");
    expect(
      urls.some((u) => u.includes("private") || u.includes("__local_snapshot")),
    ).toBe(false);
    let response: Promise<unknown> | undefined;
    const send = (url: string, mode = "navigate", method = "GET") => {
      response = undefined;
      events.fetch({
        request: { url, mode, method },
        respondWith: (p: Promise<unknown>) => {
          response = p;
        },
      });
      return response;
    };
    expect(await send("https://example.test/club-picker/?launch=home")).toBe(
      "cached:https://example.test/club-picker/index.html",
    );
    expect(send("https://example.test/other/")).toBeUndefined();
    expect(
      send("https://example.test/club-picker/__local_snapshot", "cors"),
    ).toBeUndefined();
    expect(
      send("https://example.test/club-picker/", "navigate", "POST"),
    ).toBeUndefined();
    expect(await readFile(join(root, "index.html"), "utf8")).toContain(
      'href="./manifest.webmanifest"',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
