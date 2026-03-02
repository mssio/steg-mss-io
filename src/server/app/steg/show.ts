import * as z from "zod";

const showSchema = z.object({
  password: z.string(),
  image_type: z.enum(["jpeg", "png"]),
  image_base64: z.base64(),
});

export default const showRoute = {
  async POST (req) {
    const body = await req.json();
    const parsedReq = await showSchema.safeParseAsync(body);

    if (!parsedReq.success) {
      return Response.json({
        success: false,
        api: "hide",
        errors: parsedReq.error.flatten().fieldErrors
      });
    }

    const apiUrl = `${process.env.STEG_API_URL}/show`;
    const apiKey = process.env.STEG_API_KEY;
    let resPayload;

    try {
      const res = await fetch(apiUrl, {
        "method": "POST",
        "headers": {
          "x-api-token": apiKey,
        },
        "body": JSON.stringify(parsedReq.data),
      });
      resPayload = await res.json();
    } catch (error) {
      return Response.json({
        success: false,
        api: "show",
      });
    }

    return Response.json({
      success: true,
      api: "show",
      res: resPayload,
    });
  },
};
