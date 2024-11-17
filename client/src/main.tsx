import "@radix-ui/themes/styles.css";
import "./style.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { Theme } from "@radix-ui/themes";
import { Settings, Nickname } from "@/settings";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme
      appearance="dark"
      accentColor="red"
      grayColor="gray"
      radius="full"
      hasBackground={false}
      panelBackground="translucent"
      style={{
        minHeight: 0,
        height: "100%",
        width: "100%",
      }}
    >
      <App />
      <Settings />
      <Nickname />
    </Theme>
  </React.StrictMode>
);
