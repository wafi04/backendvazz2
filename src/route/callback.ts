import { Hono } from "hono";
import { DIGI_KEY, DIGI_USERNAME } from "../constants";
import { CallbackDataParser, DuitkuCallbackService } from "../services/transaction/callbackDuitku";
import { DigiflazzCallbackService } from "../services/transaction/callbackDigi";

const callbackRoute = new Hono();

callbackRoute.post("/duitku", async (c) => {
  const service = new DuitkuCallbackService(DIGI_USERNAME, DIGI_KEY);
  const contentType = c.req.header("content-type") || "";
  let callbackData;
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

callbackRoute.post('/digiflazz', async (c) => {
  try {    
    // Get request body
    const requestBody = await c.req.json();
    
    // Validate request body
    if (!requestBody) {
      return c.json({
        success: false,
        message: "Empty request body",
        data: null
      }, 400);
    }
    
    // Determine the correct data structure
    // Handle both formats: { data: {...} } and direct payload
    const callbackData = requestBody.data ? requestBody : { data: requestBody };
        
    // Validate callback data structure
    if (!callbackData.data || typeof callbackData.data !== 'object') {
      return c.json({
        success: false,
        message: "Invalid callback data structure",
        data: null
      }, 400);
    }
    
    // Validate required fields
    const { ref_id, status } = callbackData.data;
    if (!ref_id || !status) {
      return c.json({
        success: false,
        message: "Missing required fields: ref_id or status",
        data: null
      }, 400);
    }
    
    // Process callback
    const result = await DigiflazzCallbackService.processCallback(callbackData);
    

    // Return response with appropriate status code
    const statusCode : any = result.success ? 200 : 500 
    
    return c.json({
      success: result.success,
      message: result.message,
      data: result.data || null,
    }, statusCode);
    
  } catch (error) {
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";    
    return c.json({
      success: false,
      message: "Internal server error",
      error: errorMessage,
      data: null
    }, 500);
  }
});




export default callbackRoute