import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.tsx";
import "./index.css";

const rootElement = document.querySelector("#root");

if (rootElement === null) {
  throw new Error("Expected root element to exist.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
