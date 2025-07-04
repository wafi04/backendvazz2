import { Hono } from "hono";
import { AdminTransactionLogger, FilterOptions } from "../lib/logger";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const LoggerRoutes = new Hono();
const LoggerService = new AdminTransactionLogger();

const parseQueryParams = (c: any): FilterOptions & { limit?: number; skip?: number; search?: string } => {
  const query = c.req.query();
  
  const filters: FilterOptions & { limit?: number; skip?: number; search?: string } = {};

  // Parse basic filters
  if (query.orderId) filters.orderId = query.orderId;
  if (query.transactionType) filters.transactionType = query.transactionType;
  if (query.status) filters.status = query.status;
  if (query.userId) filters.userId = query.userId;
  if (query.productCode) filters.productCode = query.productCode;
  if (query.paymentMethod) filters.paymentMethod = query.paymentMethod;
  if (query.position) filters.position = query.position;
  if (query.sessionId) filters.sessionId = query.sessionId;
  if (query.socketId) filters.socketId = query.socketId;
  if (query.reference) filters.reference = query.reference;
  if (query.ip) filters.ip = query.ip;
  if (query.userAgent) filters.userAgent = query.userAgent;

  if (query.dateFrom) {
    try {
      filters.dateFrom = new Date(query.dateFrom);
    } catch (e) {
      console.warn('Invalid dateFrom parameter:', query.dateFrom);
    }
  }
  
  if (query.dateTo) {
    try {
      filters.dateTo = new Date(query.dateTo);
    } catch (e) {
      console.warn('Invalid dateTo parameter:', query.dateTo);
    }
  }

  // Parse amount filters
  if (query.amountMin) {
    const amountMin = parseFloat(query.amountMin);
    if (!isNaN(amountMin)) filters.amountMin = amountMin;
  }
  
  if (query.amountMax) {
    const amountMax = parseFloat(query.amountMax);
    if (!isNaN(amountMax)) filters.amountMax = amountMax;
  }

  // Parse pagination
  if (query.limit) {
    const limit = parseInt(query.limit);
    if (!isNaN(limit)) filters.limit = Math.min(limit, 1000);
  }
  
  if (query.skip || query.page) {
    const skip = query.skip ? parseInt(query.skip) : 0;
    const page = query.page ? parseInt(query.page) : 1;
    filters.skip = query.skip ? skip : (page - 1) * (filters.limit || 100);
  }

  // Parse search
  if (query.search) filters.search = query.search;

  return filters;
};

LoggerRoutes.get('/logs', authMiddleware, adminMiddleware, async (c) => {
  try {
    const params = parseQueryParams(c);
    const { limit = 100, skip = 0, search, ...filters } = params;

    let result;

    if (search) {
      result = await LoggerService.searchLogs(search, limit, skip);
    } else {
      result = await LoggerService.getFilteredLogs(filters, limit, skip);
    }

    return c.json({
      status: true,
      success: true,
      message: "Retrieved Logs Successfully",
      data: result.logs,
      pagination: {
        total: result.totalCount,
        limit,
        skip,
        hasMore: result.hasMore,
        currentPage: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(result.totalCount / limit)
      }
    });

  } catch (error) {
    return c.json({
      status: false,
      success: false,
      message: "Failed to retrieve logs",
      error: error instanceof Error ? error.message : error
    }, 500);
  }
});




// Get today's logs
LoggerRoutes.get('/logs/today', authMiddleware, adminMiddleware, async (c) => {
  try {
    const query = c.req.query();
    const limit = query.limit ? parseInt(query.limit) : 100;

    const result = await LoggerService.getTodayLogs(limit);

    return c.json({
      status: true,
      success: true,
      message: "Retrieved Today's Logs Successfully",
      data: result.logs,
      pagination: {
        total: result.totalCount,
        limit,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    return c.json({
      status: false,
      success: false,
      message: "Failed to retrieve today's logs",
      error: error instanceof Error ? error.message : error
    }, 500);
  }
});


export default LoggerRoutes;