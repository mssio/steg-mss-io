import { helloRoute, helloNameRoute } from "@/server/app/hello/route";
import { hideRoute, showRoute } from "@/server/app/steg/route";

const route = {
  "/api/hello": helloRoute,
  "/api/hello/:name": helloNameRoute,
  "/api/steg/hide": hideRoute,
  "/api/steg/show": hideRoute,
};

export default route;
