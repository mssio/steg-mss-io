import * as z from "zod";

const showSchema = z.object({
  password: z.string(),
  image_type: z.enum(["jpeg", "png"]),
  image_base64: z.base64(),
});

const showRoute = {
  async POST (req) {
    const body = await req.json();
    const parsedReq = await showSchema.safeParseAsync(body);

    if (!parsedReq.success) {
      return Response.json({
        success: false,
        api: "show",
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
          "Content-Type": "application/json",
          "x-api-token": apiKey,
        },
        "body": JSON.stringify(parsedReq.data),
      });
      if (!res.ok) {
        return Response.json({ success: false, api: "show" });
      }
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

export default showRoute;
