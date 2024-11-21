import "@radix-ui/themes/styles.css";
import "./style.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { Theme } from "@radix-ui/themes";
import { ConnectionsProvider } from "@/socket/src/context/connectionsProvider.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme
      appearance="dark"
      accentColor="violet"
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
      <ConnectionsProvider>
        <App />
      </ConnectionsProvider>
    </Theme>
  </React.StrictMode>
);
