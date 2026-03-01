import { createBrowserRouter } from "react-router";
import Home from "@/client/app/home/page";
import Hello from "@/client/app/hello/page";
import { HideForm } from "@/client/app/steg/hide";

const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/hide", Component: HideForm },
]);

export default router;
