import { Hono } from "hono";
import { PaymentMethodService } from "../services/paymentMethod/service";
import { methodschema, MethodSchemas } from "../validation/paymentMethod";
import { zValidator } from "@hono/zod-validator";
import { z } from 'zod';

const hono = new Hono();
const paymentMethodService = new PaymentMethodService();

// Validation schemas
const idParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10))
});

const codeParamSchema = z.object({
  code: z.string().min(1)
});

// GET /payment-methods - Get all payment methods
hono.get('/', async (c) => {
  try {
    const status = c.req.query('status') || 'active';
    const paymentMethods = await paymentMethodService.getPaymentMethods(status);
    return c.json({
      success: true,
      message: "Payment methods retrieved successfully",
      data: paymentMethods
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return c.json({
      success: false,
      message: "Failed to retrieve payment methods",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// GET /payment-methods/:id - Get payment method by ID
hono.get('/:id', zValidator('param', idParamSchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const paymentMethod = await paymentMethodService.getPaymentMethodById(id);
    
    if (!paymentMethod) {
      return c.json({
        success: false,
        message: "Payment method not found"
      }, 404);
    }

    return c.json({
      success: true,
      message: "Payment method retrieved successfully",
      data: paymentMethod
    });
  } catch (error) {
    console.error('Error fetching payment method:', error);
    return c.json({
      success: false,
      message: "Failed to retrieve payment method",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// GET /payment-methods/code/:code - Get payment method by code
hono.get('/code/:code', zValidator('param', codeParamSchema), async (c) => {
  try {
    const { code } = c.req.valid('param');
    const paymentMethod = await paymentMethodService.getPaymentMethodByCode(code);
    
    if (!paymentMethod) {
      return c.json({
        success: false,
        message: "Payment method not found"
      }, 404);
    }

    return c.json({
      success: true,
      message: "Payment method retrieved successfully",
      data: paymentMethod
    });
  } catch (error) {
    console.error('Error fetching payment method by code:', error);
    return c.json({
      success: false,
      message: "Failed to retrieve payment method",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// POST /payment-methods - Create new payment method
hono.post('/', zValidator('json', methodschema), async (c) => {
  try {
    const paymentMethodData = c.req.valid('json');
    const newPaymentMethod = await paymentMethodService.addPaymentMethod(paymentMethodData);
    
    return c.json({
      success: true,
      message: "Payment method created successfully",
      data: newPaymentMethod
    }, 201);
  } catch (error) {
    console.error('Error creating payment method:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      return c.json({
        success: false,
        message: error.message
      }, 409);
    }
    return c.json({
      success: false,
      message: "Failed to create payment method",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

// PUT /payment-methods/:id - Update payment method
hono.put('/:id', 
  zValidator('param', idParamSchema),
  zValidator('json', methodschema),
  async (c) => {
    try {
      const { id } = c.req.valid('param');
      const updateData = c.req.valid('json');
      
      const updatedPaymentMethod = await paymentMethodService.updateSubCategory(id, updateData);
      
      return c.json({
        success: true,
        message: "Payment method updated successfully",
        data: updatedPaymentMethod
      });
    } catch (error) {
      console.error('Error updating payment method:', error);
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return c.json({
          success: false,
          message: "Payment method not found"
        }, 404);
      }
      return c.json({
        success: false,
        message: "Failed to update payment method",
        error: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  }
);

// PATCH /payment-methods/:id - Partial update payment method
hono.patch('/:id',
  zValidator('param', idParamSchema),
  zValidator('json', methodschema.partial()),
  async (c) => {
    try {
      const { id } = c.req.valid('param');
      const updateData = c.req.valid('json');
      
      const updatedPaymentMethod = await paymentMethodService.updateSubCategory(id, updateData as MethodSchemas);
      
      return c.json({
        success: true,
        message: "Payment method updated successfully",
        data: updatedPaymentMethod
      });
    } catch (error) {
      console.error('Error updating payment method:', error);
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return c.json({
          success: false,
          message: "Payment method not found"
        }, 404);
      }
      return c.json({
        success: false,
        message: "Failed to update payment method",
        error: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  }
);

// DELETE /payment-methods/:id - Delete payment method
hono.delete('/:id', zValidator('param', idParamSchema), async (c) => {
  try {
    const { id } = c.req.valid('param');
    const deletedPaymentMethod = await paymentMethodService.deletePaymentMethod(id);
    
    return c.json({
      success: true,
      message: "Payment method deleted successfully",
      data: deletedPaymentMethod
    });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return c.json({
        success: false,
        message: "Payment method not found"
      }, 404);
    }
    return c.json({
      success: false,
      message: "Failed to delete payment method",
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
});

export default hono;