import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import { VoucherValidation, ValidateVoucherInput, createVoucherSchema, updateVoucherSchema, validateVoucherSchema, useVoucherSchema } from '../validation/voucher';
import { Voucher } from '../services/voucher/voucher';

const app = new Hono();
const voucherService = new Voucher();

app.get('/', async (c) => {
  try {
    const query = c.req.query();
    const filters = {
      isActive: query.isActive,
      discountType: query.discountType,
      search: query.search,
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 10,
    };

    const result = await voucherService.findAll(filters);
    
    return c.json({
      success: true,
      message: 'Vouchers retrieved successfully',
      data: {
        data : result
      }
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

// GET /vouchers/:id - Get voucher by ID
app.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { message: 'Invalid voucher ID' });
    }

    const voucher = await voucherService.findById(id);
    
    if (!voucher) {
      throw new HTTPException(404, { message: 'Voucher not found' });
    }

    return c.json({
      success: true,
      message: 'Voucher retrieved successfully',
      data: voucher,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error fetching voucher:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

// GET /vouchers/code/:code - Get voucher by code
app.get('/code/:code', async (c) => {
  try {
    const code = c.req.param('code');
    
    if (!code) {
      throw new HTTPException(400, { message: 'Voucher code is required' });
    }

    const voucher = await voucherService.findByCode(code);
    
    if (!voucher) {
      throw new HTTPException(404, { message: 'Voucher not found' });
    }

    return c.json({
      success: true,
      message: 'Voucher retrieved successfully',
      data: voucher,
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error fetching voucher by code:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

// POST /vouchers - Create new voucher
app.post('/', 
  validator('json', (value, c) => {
    const parsed = createVoucherSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validation error',
        errors: parsed.error.errors,
      }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const data = c.req.valid('json');
      const voucher = await voucherService.create(data as VoucherValidation);
      
      return c.json({
        success: true,
        message: 'Voucher created successfully',
        data: voucher,
      }, 201);
    } catch (error) {
      console.error('Error creating voucher:', error);
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  }
);

// PUT /vouchers/:id - Update voucher
app.put('/:id',
  validator('json', (value, c) => {
    const parsed = updateVoucherSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validation error',
        errors: parsed.error.errors,
      }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const id = parseInt(c.req.param('id'));
      
      if (isNaN(id)) {
        throw new HTTPException(400, { message: 'Invalid voucher ID' });
      }

      const data = c.req.valid('json');
      const voucher = await voucherService.update(id, data);
      
      return c.json({
        success: true,
        message: 'Voucher updated successfully',
        data: voucher,
      });
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      console.error('Error updating voucher:', error);
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  }
);

// DELETE /vouchers/:id - Delete voucher
app.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    if (isNaN(id)) {
      throw new HTTPException(400, { message: 'Invalid voucher ID' });
    }

    await voucherService.delete(id);
    
    return c.json({
      success: true,
      message: 'Voucher deleted successfully',
    });
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error('Error deleting voucher:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

// POST /vouchers/validate - Validate voucher
app.post('/validate',
  validator('json', (value, c) => {
    const parsed = validateVoucherSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validation error',
        errors: parsed.error.errors,
      }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const data = c.req.valid('json');
      const result = await voucherService.validateVoucher(data as ValidateVoucherInput);
      
      return c.json({
        success: true,
        message: 'Voucher is valid',
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPException(400, { message: error.message });
      }
      console.error('Error validating voucher:', error);
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  }
);

// POST /vouchers/use - Use voucher
app.post('/use',
  validator('json', (value, c) => {
    const parsed = useVoucherSchema.safeParse(value);
    if (!parsed.success) {
      return c.json({
        success: false,
        message: 'Validation error',
        errors: parsed.error.errors,
      }, 400);
    }
    return parsed.data;
  }),
  async (c) => {
    try {
      const { voucherId, orderId, amount, username, whatsapp } = c.req.valid('json');
      
      const usage = await voucherService.useVoucher(
        voucherId,
        orderId,
        amount,
        username,
        whatsapp
      );
      
      return c.json({
        success: true,
        message: 'Voucher used successfully',
        data: usage,
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new HTTPException(400, { message: error.message });
      }
      console.error('Error using voucher:', error);
      throw new HTTPException(500, { message: 'Internal server error' });
    }
  }
);

// DELETE /vouchers/cache/clear - Clear all voucher caches (admin only)
app.delete('/cache/clear', async (c) => {
  try {
    await voucherService.clearAllCaches();
    
    return c.json({
      success: true,
      message: 'All voucher caches cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing voucher caches:', error);
    throw new HTTPException(500, { message: 'Internal server error' });
  }
});

export default app;