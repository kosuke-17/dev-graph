import { StrictMode } from "react";
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { routes } from "./routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {routes.map(({ path, Component }, i) => (
          <Route key={i} path={path} element={<Component />} />
        ))}
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
