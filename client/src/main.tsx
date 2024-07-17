import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "./style.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme
      appearance="dark"
      accentColor="violet"
      grayColor="auto"
      radius="full"
      hasBackground={false}
      panelBackground="translucent"
      style={{
        minHeight: 0,
        height: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "fixed",
          zIndex: -10,
          backgroundImage: "url(/background.png)",
          opacity: 0.25,
          inset: 0,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <App />
    </Theme>
  </React.StrictMode>
);
