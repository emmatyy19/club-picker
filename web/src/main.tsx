import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "./design/controls.css";
import { greenTheme } from "./design/theme";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/latin-800.css";
import "@fontsource/nunito-sans/latin-900.css";
async function boot() {
  const root = ReactDOM.createRoot(document.getElementById("root")!);
  if (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("design") === "green"
  ) {
    const { GreenPreview } = await import("./design/GreenPreview");
    root.render(
      <React.StrictMode>
        <GreenPreview />
      </React.StrictMode>,
    );
    return;
  }
  await import("./styles.css");
  const { App } = await import("./App");
  root.render(
    <React.StrictMode>
      <MantineProvider theme={greenTheme} forceColorScheme="light">
        <App />
      </MantineProvider>
    </React.StrictMode>,
  );
}
void boot();
