import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
// Development only: one explicitly prepared file, never copied into a build.
const snapshot = fileURLToPath(
  new URL("../data/private/explorer/snapshot.json", import.meta.url),
);
export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-reviewed-snapshot",
      configureServer(server) {
        if (server.config.mode === "showcase") return;
        server.middlewares.use(
          "/__local_snapshot",
          async (_request, response) => {
            response.setHeader("Cache-Control", "no-store");
            try {
              const contents = await readFile(snapshot);
              response.setHeader("Content-Type", "application/json");
              response.end(contents);
            } catch {
              response.statusCode = 204;
              response.end();
            }
          },
        );
      },
    },
  ],
  server: { host: "127.0.0.1", fs: { strict: true } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["echarts"],
          controls: ["@mantine/core", "@mantine/hooks"],
          validation: ["zod"],
        },
      },
    },
  },
});
