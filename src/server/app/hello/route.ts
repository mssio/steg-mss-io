export const helloRoute = {
  async GET(req) {
    return Response.json({
      message: "Hello, world!",
      method: "GET",
    });
  },
  async PUT(req) {
    return Response.json({
      message: "Hello, world!",
      method: "PUT",
    });
  },
};

export const helloNameRoute = async req => {
  const name = req.params.name;
  return Response.json({
    message: `Hello, ${name}!`,
  });
};
