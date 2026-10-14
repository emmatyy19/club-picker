import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import "./styles.css";
import { App } from "./App";
const theme = createTheme({
  primaryColor: "teal",
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  defaultRadius: "md",
  colors: {
    teal: [
      "#edf6f2",
      "#d9e9e1",
      "#b5d1c3",
      "#8bb6a2",
      "#679e85",
      "#4d8a6f",
      "#3b785e",
      "#2c654f",
      "#245541",
      "#1b4836",
    ],
  },
  headings: { fontFamily: "inherit", fontWeight: "550" },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} forceColorScheme="light">
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
