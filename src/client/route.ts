import { createBrowserRouter } from "react-router";
import Home from "@/client/app/home/page";
import Hello from "@/client/app/hello/page";
import { HideForm } from "@/client/app/steg/Hide";
import { HideComplete } from "@/client/app/steg/HideComplete";
import { ShowForm } from "@/client/app/steg/Show";
import { ShowComplete } from "@/client/app/steg/ShowComplete";

const router = createBrowserRouter([
  { path: "/", Component: Home },
  { path: "/hide", Component: HideForm },
  { path: "/hide/complete", Component: HideComplete },
  { path: "/show", Component: ShowForm },
  { path: "/show/complete", Component: ShowComplete },
]);

export default router;
