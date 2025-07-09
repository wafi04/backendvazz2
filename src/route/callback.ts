import { Hono } from "hono";
import { DIGI_KEY, DIGI_USERNAME } from "../constants";
import { CallbackDataParser, DuitkuCallbackService } from "../services/transaction/callbackDuitku";

const callbackRoute = new Hono();

callbackRoute.post("/duitku", async (c) => {
  const service = new DuitkuCallbackService(DIGI_USERNAME, DIGI_KEY);
  const contentType = c.req.header("content-type") || "";
  let callbackData;
  console.log('started callback data')
  if (contentType.includes("application/json")) {
    const jsonData = await c.req.json();
    callbackData = await CallbackDataParser.parseJSON(jsonData);
  } else if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await c.req.formData();
    callbackData = await CallbackDataParser.parseFormData(formData);
  } else {
    const rawBody = await c.req.text();
    callbackData = await CallbackDataParser.parseURLEncoded(rawBody);
  }
  
  // Process callback
  const result = await service.processCallback(callbackData);
  
  return c.json({
    success: result.success,
    message: result.message,
    data: result.data,
  },200);
});

export default callbackRoute