import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validator } from 'hono/validator';
import DepositAnalyticsService from '../../services/dashboard/deposit';

const app = new Hono();

// Initialize service
const analyticsService = new DepositAnalyticsService();

// Utility functions
const validateDate = (date: string) => {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : null;
};

const successResponse = (data: any, message: string = 'Success') => ({
  success: true,
  message,
  data
});

const errorResponse = (message: string, error?: any) => ({
  success: false,
  message,
  error: error?.message || error
});

// Common validator for date range
const dateRangeValidator = validator('query', (value, c) => {
  const { startDate, endDate } = value;
  
  if (!startDate || !endDate) {
    return c.json(errorResponse('startDate and endDate are required'), 400);
  }
  
  const validStartDate = validateDate(Array.isArray(startDate) ? startDate[0] : startDate as string);
  const validEndDate = validateDate(Array.isArray(endDate) ? endDate[0] : endDate as string);
  
  if (!validStartDate || !validEndDate) {
    return c.json(errorResponse('Invalid date format. Use YYYY-MM-DD'), 400);
  }
  
  return {
    startDate: validStartDate,
    endDate: validEndDate
  };
});

// Validator for date range with limit
const dateRangeWithLimitValidator = validator('query', (value, c) => {
  const { startDate, endDate, limit } = value;
  
  if (!startDate || !endDate) {
    return c.json(errorResponse('startDate and endDate are required'), 400);
  }
  
  const validStartDate = validateDate(startDate as string);
  const validEndDate = validateDate(endDate as string);
  
  if (!validStartDate || !validEndDate) {
    return c.json(errorResponse('Invalid date format. Use YYYY-MM-DD'), 400);
  }
  
  const validLimit = limit ? parseInt(limit as string) : 10;
  if (isNaN(validLimit) || validLimit < 1 || validLimit > 100) {
    return c.json(errorResponse('Limit must be a number between 1 and 100'), 400);
  }
  
  return {
    startDate: validStartDate,
    endDate: validEndDate,
    limit: validLimit
  };
});

// Generic handler wrapper for routes without parameters
const createSimpleHandler = (serviceMethod: string, successMessage: string) => {
  return async (c: any) => {
    try {
      const data = await (analyticsService as any)[serviceMethod]();
      return c.json(successResponse(data, successMessage));
    } catch (error) {
      return c.json(errorResponse(`Failed to get ${successMessage.toLowerCase()}`, error), 500);
    }
  };
};

// Generic handler wrapper for routes with parameters
const createHandlerWithParams = (serviceMethod: string, successMessage: string) => {
  return async (c: any) => {
    try {
      const validatedData = c.req.valid('query');
      const data = await (analyticsService as any)[serviceMethod](...Object.values(validatedData));
      return c.json(successResponse(data, successMessage));
    } catch (error) {
      return c.json(errorResponse(`Failed to get ${successMessage.toLowerCase()}`, error), 500);
    }
  };
};

// Routes without validation (no parameters needed)
app.get('/today', createSimpleHandler('getTodayAnalytics', 'Today analytics retrieved successfully'));
app.get('/monthly', createSimpleHandler('getMonthlyAnalytics', 'Monthly analytics retrieved successfully'));
app.get('/hourly', createSimpleHandler('getHourlyAnalytics', 'Hourly analytics retrieved successfully'));

// Routes with date range validation
app.get('/status', dateRangeValidator, createHandlerWithParams('getStatusAnalytics', 'Status analytics retrieved successfully'));
app.get('/percentage', dateRangeValidator, createHandlerWithParams('getAnalyticsWithPercentage', 'Percentage analytics retrieved successfully'));
app.get('/trend/daily', dateRangeValidator, createHandlerWithParams('getDailyTrend', 'Daily trend retrieved successfully'));
app.get('/method-status', dateRangeValidator, createHandlerWithParams('getMethodStatusAnalytics', 'Method status analytics retrieved successfully'));
app.get('/summary', dateRangeValidator, createHandlerWithParams('getSummaryAnalytics', 'Summary analytics retrieved successfully'));
app.get('/revenue', dateRangeValidator, createHandlerWithParams('getRevenueAnalytics', 'Revenue analytics retrieved successfully'));

// Route with date range and limit validation
app.get('/top-users', dateRangeWithLimitValidator, createHandlerWithParams('getTopUsersAnalytics', 'Top users analytics retrieved successfully'));

// Quick range route (special case)
app.get('/quick/:range', async (c) => {
  try {
    const range = c.req.param('range');
    const validRanges = ['today', 'yesterday', 'week', 'month', '3months'];
    
    if (!validRanges.includes(range)) {
      return c.json(errorResponse('Invalid range. Use: today, yesterday, week, month, 3months'), 400);
    }
    
    const { startDate, endDate } = analyticsService.getDateRange(range);
    const data = await analyticsService.getStatusAnalytics(
      startDate.toISOString().split('T')[0], 
      endDate.toISOString().split('T')[0]
    );
    
    return c.json(successResponse(data, `Analytics for ${range} retrieved successfully`));
  } catch (error) {
    return c.json(errorResponse('Failed to get quick range analytics', error), 500);
  }
});

export default app;
