import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
export function offlinePlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "my-caddie-offline",
    apply: "build",
    configResolved(value) {
      config = value;
    },
    async closeBundle() {
      if (config.mode !== "phone") return;
      const root = resolve(config.root, config.build.outDir);
      const manifest = {
        id: "./",
        name: "My Caddie",
        short_name: "My Caddie",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f5f7f3",
        theme_color: "#3b785e",
        icons: [
          {
            src: "bunny-caddie.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      };
      await writeFile(
        resolve(root, "manifest.webmanifest"),
        JSON.stringify(manifest),
      );
      const index = resolve(root, "index.html");
      await writeFile(
        index,
        (await readFile(index, "utf8")).replace(
          "</head>",
          '<link rel="manifest" href="./manifest.webmanifest"><meta name="theme-color" content="#3b785e"></head>',
        ),
      );
      const files: string[] = [];
      async function walk(dir: string) {
        for (const e of await readdir(dir, { withFileTypes: true })) {
          const path = resolve(dir, e.name);
          if (e.isDirectory()) await walk(path);
          else if (e.name !== "sw.js")
            files.push(relative(root, path).split("\\").join("/"));
        }
      }
      await walk(root);
      files.sort();
      const hash = createHash("sha256");
      for (const f of files)
        hash.update(f).update(await readFile(resolve(root, f)));
      const version = hash.digest("hex").slice(0, 16);
      await writeFile(
        resolve(root, "sw.js"),
        `
const ROOT = self.registration.scope;
const PREFIX = 'my-caddie-shell:' + ROOT + ':';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(files)}.map(p => new URL(p, ROOT).href);
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(FILES))
));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if(event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== new URL(ROOT).origin || !url.href.startsWith(ROOT)) return;
  const isHome = event.request.mode === 'navigate' &&
    (url.pathname === new URL(ROOT).pathname || url.pathname === new URL('index.html', ROOT).pathname);
  const key = isHome ? new URL('index.html',ROOT).href : event.request.url;
  if(!FILES.includes(key)) return;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
`,
      );
    },
  };
}
