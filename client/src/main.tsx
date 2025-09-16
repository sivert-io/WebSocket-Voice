import "@radix-ui/themes/styles.css";
import "./style.css";

import { Theme } from "@radix-ui/themes";
import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App.tsx";
import { useTheme } from "@/common";
import { Toaster } from "react-hot-toast";

function ThemedApp() {
  const {
    resolvedAppearance,
    accentColor,
    grayColor,
    hasBackground,
    panelBackground,
    radius,
  } = useTheme();
  return (
    <Theme
      appearance={resolvedAppearance}
      accentColor={accentColor}
      grayColor={grayColor}
      radius={radius}
      hasBackground={hasBackground}
      panelBackground={panelBackground}
      style={{
        minHeight: 0,
        height: "100%",
        width: "100%",
      }}
    >
      <App />
      <Toaster position="bottom-right" />
    </Theme>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemedApp />
  </React.StrictMode>
);