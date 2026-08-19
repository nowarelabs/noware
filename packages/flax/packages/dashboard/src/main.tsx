import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@cloudflare/kumo/styles/standalone";
import "./styles.css";
import { App } from "./App";

(() => {
  try {
    const dark = localStorage.getItem("flax.dashboard.dark") === "1";
    document.documentElement.setAttribute("data-mode", dark ? "dark" : "light");
  } catch {
    document.documentElement.setAttribute("data-mode", "light");
  }
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
