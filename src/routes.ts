import type { RouteProps } from "react-router-dom";
import { Home } from "./pages";
import { About } from "./pages/about";

export const routes = [
  {
    path: "/",
    Component: Home,
  },

  {
    path: "/about",
    Component: About,
  },
] as const satisfies RouteProps[];
