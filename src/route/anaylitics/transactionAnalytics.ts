import { Hono } from "hono";
import { AnalyticsService } from "../../services/analytics/analytics";
import { prisma } from "../../lib/prisma";
import { validator } from "hono/validator";
import z from "zod";
import { analyticsQuerySchema } from "../../validation/analytics";

export const TransactionAnalyticsRoute = new Hono()
const analyticsService = new AnalyticsService(prisma)

// Validation helper
const validateDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
  }
  
  if (start > end) {
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  return { isValid: true, startDate: start, endDate: end };
};

// GET /analytics - Get comprehensive analytics with filters
TransactionAnalyticsRoute.get('/analytics', async (c) => {
  try {
    const { startDate, endDate, transactionType, status, username } = c.req.query();
    
    // Validate required parameters
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        message: 'startDate and endDate are required'
      }, 400);
    }
    
    // Validate date range
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return c.json({
        success: false,
        message: dateValidation.error
      }, 400);
    }
    
    // Validate transaction type
    const validTypes = ['MEMBERSHIP', 'DEPOSIT', 'TOPUP'];
    if (transactionType && !validTypes.includes(transactionType.toUpperCase())) {
      return c.json({
        success: false,
        message: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`
      }, 400);
    }
    
    const analytics = await analyticsService.getAnalytics({
      startDate: dateValidation.startDate!,
      endDate: dateValidation.endDate!,
      transactionType: transactionType?.toUpperCase() as any,
      status,
      username
    });
    
    return c.json({
      success: true,
      data: analytics,
      filters: {
        startDate: dateValidation.startDate,
        endDate: dateValidation.endDate,
        transactionType,
        status,
        username
      }
    });
    
  } catch (error : any) {
    return c.json({
      success: false,
      message: 'Failed to get analytics data'
    }, 500);
  }
});

TransactionAnalyticsRoute.get('/analytics/type/data', async (c) => {
  try {
    const { startDate, endDate, status, username, type } = c.req.query();
        
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        message: 'startDate and endDate are required'
      }, 400);
    }
    
   
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return c.json({
        success: false,
        message: dateValidation.error
      }, 400);
    }
    
    const analytics = await analyticsService.getAnalyticsByType(
      dateValidation.startDate!,
      dateValidation.endDate!,
      type,
      status,
    );
    
    return c.json({
      success: true,
      data: analytics,
    });
    
  } catch (error : any) {
    console.error('Analytics by type error:', error);
    return c.json({
      success: false,
      message: 'Failed to get analytics by type',
      error: error?.message 
    }, 500);
  }
});

TransactionAnalyticsRoute.get('/analytics/top-services', async (c) => {
  try {
    const { startDate, endDate, transactionType, status, username, limit } = c.req.query();
    
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        message: 'startDate and endDate are required'
      }, 400);
    }
    
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return c.json({
        success: false,
        message: dateValidation.error
      }, 400);
    }
    
    // Validate transaction type
    const validTypes = ['MEMBERSHIP', 'TOPUP']; // DEPOSIT tidak memiliki service
    if (transactionType && !validTypes.includes(transactionType.toUpperCase())) {
      return c.json({
        success: false,
        message: `Invalid transaction type for services. Must be one of: ${validTypes.join(', ')}`
      }, 400);
    }
    
    const limitNum = limit ? parseInt(limit) : 10;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return c.json({
        success: false,
        message: 'Limit must be a number between 1 and 100'
      }, 400);
    }
    
    const topServices = await analyticsService.getTopServices({
      startDate: dateValidation.startDate!,
      endDate: dateValidation.endDate!,
      transactionType: transactionType?.toUpperCase() as any,
      status,
    }, limitNum);
    
    return c.json({
      success: true,
      data: topServices,
      filters: {
        startDate: dateValidation.startDate,
        endDate: dateValidation.endDate,
        transactionType,
        status,
        username,
        limit: limitNum
      }
    });
    
  } catch (error : any) {
    console.error('Top services error:', error);
    return c.json({
      success: false,
      message: 'Failed to get top services data'
    }, 500);
  }
});

// GET /analytics/daily - Get daily statistics
TransactionAnalyticsRoute.get('/analytics/daily', async (c) => {
  try {
    const { startDate, endDate, transactionType, status, username } = c.req.query();
    
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        message: 'startDate and endDate are required'
      }, 400);
    }
    
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return c.json({
        success: false,
        message: dateValidation.error
      }, 400);
    }
    
    const analytics = await analyticsService.getAnalytics({
      startDate: dateValidation.startDate!,
      endDate: dateValidation.endDate!,
      transactionType: transactionType?.toUpperCase() as any,
      status,
      username
    });
    
    return c.json({
      success: true,
      data: {
        dailyStats: analytics.dailyStats,
        summary: {
          totalDays: analytics.dailyStats.length,
          averagePerDay: analytics.dailyStats.length > 0 
            ? analytics.totalTransactions / analytics.dailyStats.length 
            : 0,
          peakDay: analytics.dailyStats.reduce((max, day) => 
            day.count > max.count ? day : max, 
            analytics.dailyStats[0] || { date: '', count: 0 }
          )
        }
      }
    });
    
  } catch (error : any) {
    console.error('Daily analytics error:', error);
    return c.json({
      success: false,
      message: 'Failed to get daily analytics'
    }, 500);
  }
});

// GET /analytics/summary - Get quick summary statistics
TransactionAnalyticsRoute.get('/analytics/summary', async (c) => {
  try {
    const { startDate, endDate, transactionType } = c.req.query();
    
    if (!startDate || !endDate) {
      return c.json({
        success: false,
        message: 'startDate and endDate are required'
      }, 400);
    }
    
    const dateValidation = validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      return c.json({
        success: false,
        message: dateValidation.error
      }, 400);
    }
    
    const analytics = await analyticsService.getAnalytics({
      startDate: dateValidation.startDate!,
      endDate: dateValidation.endDate!,
      transactionType: transactionType?.toUpperCase() as any
    });
    
    return c.json({
      success: true,
      data: {
        totalTransactions: analytics.totalTransactions,
        totalAmount: analytics.totalAmount,
        totalProfit: analytics.totalProfit,
        averageAmount: analytics.averageAmount,
        transactionsByType: analytics.transactionsByType,
        transactionsByStatus: analytics.transactionsByStatus,
        dateRange: {
          startDate: dateValidation.startDate,
          endDate: dateValidation.endDate,
          days: Math.ceil((dateValidation.endDate!.getTime() - dateValidation.startDate!.getTime()) / (1000 * 60 * 60 * 24))
        }
      }
    });
    
  } catch (error : any) {
    console.error('Summary analytics error:', error);
    return c.json({
      success: false,
      message: 'Failed to get summary analytics'
    }, 500);
  }
});

// 2. Route untuk top products (TOPUP)
TransactionAnalyticsRoute.get('/analytics/top-products',
  validator('query', (value, c) => {
    const result = analyticsQuerySchema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid query parameters', details: result.error.errors }, 400);
    }
    return result.data;
  }),
  async (c) => {
    try {
      const query = c.req.valid('query');
      
      const topProducts = await analyticsService.getTopProducts({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        status: query.status,
        username: query.username
      }, query.limit);

      return c.json({
        success: true,
        data: topProducts,
        meta: {
          startDate: query.startDate,
          endDate: query.endDate,
          limit: query.limit,
          filters: {
            status: query.status,
            username: query.username
          }
        }
      });
    } catch (error : any) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch top products', 
        details: error.message 
      }, 500);
    }
  }
);

// 3. Route untuk active users
TransactionAnalyticsRoute.get('/analytics/active-users',
  validator('query', (value, c) => {
    const result = analyticsQuerySchema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid query parameters', details: result.error.errors }, 400);
    }
    return result.data;
  }),
  async (c) => {
    try {
      const query = c.req.valid('query');
      
      const activeUsers = await analyticsService.getActiveUsers({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        transactionType: query.transactionType,
        status: query.status
      }, query.limit);

      return c.json({
        success: true,
        data: activeUsers,
        meta: {
          startDate: query.startDate,
          endDate: query.endDate,
          limit: query.limit,
          filters: {
            transactionType: query.transactionType,
            status: query.status
          }
        }
      });
    } catch (error : any) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch active users', 
        details: error.message 
      }, 500);
    }
  }
);

// 4. Route untuk user activity breakdown
TransactionAnalyticsRoute.get('/analytics/user-breakdown',
  validator('query', (value, c) => {
    const result = analyticsQuerySchema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid query parameters', details: result.error.errors }, 400);
    }
    return result.data;
  }),
  async (c) => {
    try {
      const query = c.req.valid('query');
      
      const userBreakdown = await analyticsService.getUserActivityBreakdown({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        transactionType: query.transactionType,
        status: query.status
      }, query.limit);

      return c.json({
        success: true,
        data: userBreakdown,
        meta: {
          startDate: query.startDate,
          endDate: query.endDate,
          limit: query.limit,
          filters: {
            transactionType: query.transactionType,
            status: query.status
          }
        }
      });
    } catch (error : any) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch user breakdown', 
        details: error.message 
      }, 500);
    }
  }
);

// 5. Route untuk combined product & user analytics
TransactionAnalyticsRoute.get('/analytics/combined',
  validator('query', (value, c) => {
    const extendedSchema = analyticsQuerySchema.extend({
      productLimit: z.string().transform(Number).optional().default('10'),
      userLimit: z.string().transform(Number).optional().default('10')
    });
    
    const result = extendedSchema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid query parameters', details: result.error.errors }, 400);
    }
    return result.data;
  }),
  async (c) => {
    try {
      const query = c.req.valid('query');
      
      const combined = await analyticsService.getProductUserAnalytics({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        transactionType: query.transactionType,
        status: query.status,
        username: query.username
      }, query.productLimit, query.userLimit);

      return c.json({
        success: true,
        data: combined,
        meta: {
          startDate: query.startDate,
          endDate: query.endDate,
          limits: {
            products: query.productLimit,
            users: query.userLimit
          },
          filters: {
            transactionType: query.transactionType,
            status: query.status,
            username: query.username
          }
        }
      });
    } catch (error : any) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch combined analytics', 
        details: error.message 
      }, 500);
    }
  }
);

// 6. Route untuk daily user activity
TransactionAnalyticsRoute.get('/analytics/daily-activity',
  validator('query', (value, c) => {
    const result = analyticsQuerySchema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid query parameters', details: result.error.errors }, 400);
    }
    return result.data;
  }),
  async (c) => {
    try {
      const query = c.req.valid('query');
      
      const dailyActivity = await analyticsService.getDailyUserActivity({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        transactionType: query.transactionType,
        status: query.status
      });

      return c.json({
        success: true,
        data: dailyActivity,
        meta: {
          startDate: query.startDate,
          endDate: query.endDate,
          filters: {
            transactionType: query.transactionType,
            status: query.status
          }
        }
      });
    } catch (error : any) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch daily activity', 
        details: error.message 
      }, 500);
    }
  }
);

// 7. Route untuk analytics by specific user
TransactionAnalyticsRoute.get('/analytics/user/:username',
  validator('param', (value, c) => {
    const schema = z.object({
      username: z.string().min(1)
    });
    
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid username parameter' }, 400);
    }
    return result.data;
  }),
  validator('query', (value, c) => {
    const schema = z.object({
      startDate: z.string().refine((date) => !isNaN(Date.parse(date))),
      endDate: z.string().refine((date) => !isNaN(Date.parse(date))),
      transactionType: z.enum(['TOPUP', 'DEPOSIT', 'MEMBERSHIP']).optional(),
      status: z.string().optional()
    });
    
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json({ error: 'Invalid query parameters', details: result.error.errors }, 400);
    }
    return result.data;
  }),
  async (c) => {
    try {
      const param = c.req.valid('param');
      const query = c.req.valid('query');
      
      const userAnalytics = await analyticsService.getAnalytics({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        transactionType: query.transactionType,
        status: query.status,
        username: param.username
      });

      return c.json({
        success: true,
        data: userAnalytics,
        meta: {
          username: param.username,
          startDate: query.startDate,
          endDate: query.endDate,
          filters: {
            transactionType: query.transactionType,
            status: query.status
          }
        }
      });
    } catch (error : any) {
      return c.json({ 
        success: false, 
        error: 'Failed to fetch user analytics', 
        details: error.message 
      }, 500);
    }
  }
);


export default TransactionAnalyticsRoute
