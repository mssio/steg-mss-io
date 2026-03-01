import { createBrowserRouter } from "react-router";
import Home from '@/client/app/home/page'

const router = createBrowserRouter([
  { path: "/", Component: Home },
]);

export default router;
