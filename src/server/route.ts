import { helloRoute, helloNameRoute } from "@/server/app/hello/route";

const route = {
  "/api/hello": helloRoute,

  "/api/hello/:name": helloNameRoute,
};

export default route;
