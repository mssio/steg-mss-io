import * as z from "zod";

const hideSchema = z.object({
  secret_message: z.string(),
  password: z.string(),
  image_type: z.enum(["jpeg", "png"]),
  image_base64: z.base64(),
});

const hideRoute = {
  async POST (req) {
    const body = await req.json();
    const parsedReq = await hideSchema.safeParseAsync(body);

    if (!parsedReq.success) {
      return Response.json({
        success: false,
        api: "hide",
        errors: parsedReq.error.flatten().fieldErrors
      });
    }

    const apiUrl = `${process.env.STEG_API_URL}/hide`;
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
        return Response.json({ success: false, api: "hide" });
      }
      resPayload = await res.json();
    } catch (error) {
      return Response.json({
        success: false,
        api: "hide",
      });
    }

    return Response.json({
      success: true,
      api: "hide",
      res: resPayload,
    });
  },
};

export default hideRoute;
