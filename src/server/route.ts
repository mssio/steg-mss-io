import { helloRoute, helloNameRoute } from "@/server/app/hello/route";
import hideRoute from "@/server/app/steg/hide";
import showRoute from "@/server/app/steg/show";

const route = {
  "/api/hello": helloRoute,
  "/api/hello/:name": helloNameRoute,
  "/api/steg/hide": hideRoute,
  "/api/steg/show": hideRoute,
};

export default route;
