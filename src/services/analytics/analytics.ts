import { PrismaClient, Prisma } from "@prisma/client";

interface AnalyticsFilter {
  startDate: Date;
  endDate: Date;
  transactionType?: string
  status?: string;
  username?: string;
}

interface AnalyticsResult {
  totalTransactions: number;
  totalAmount: number;
  totalProfit: number;
  averageAmount: number;
  transactionsByType: {
    MEMBERSHIP: number;
    DEPOSIT: number;
    TOPUP: number;
  };
  transactionsByStatus: Record<string, number>;
  dailyStats: Array<{
    date: string;
    count: number;
    amount: number;
    profit: number;
  }>;
}

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}
    async getAnalytics(filter: AnalyticsFilter): Promise<AnalyticsResult> {
    const { startDate, endDate, transactionType, status, username } = filter;

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999); 

    const baseWhere = {
        createdAt: {
        gte: startDateTime,
        lte: endDateTime,
      },
        ...(transactionType && { transactionType }),
        ...(status && { status }),
      ...(username && { username }),
      
    };

    const [
        transactions,
        deposits,
        transactionStats,
        depositStats,
        dailyTransactionStats,
        dailyDepositStats
    ] = await Promise.all([
        // Get all transactions
        this.prisma.transaction.findMany({
        where: baseWhere,
        select: {
            id: true,
            price: true,
            profit: true,
            serviceName : true,
            purchasePrice: true,
            discount: true,
            profitAmount: true,
            status: true,
            transactionType: true,
            createdAt: true,
        },
        }),

        // Get all deposits (jika tidak ada filter atau filter DEPOSIT)
        !transactionType || transactionType === 'DEPOSIT' 
        ? this.prisma.deposit.findMany({
          where: {

              createdAt: {
                gte: startDateTime,
                lte: endDateTime,
                },
            },
            select: {
                id: true,
                amount: true,
                status: true,
                createdAt: true,
            },
            })
        : [],

        // Aggregate stats untuk transactions
        this.prisma.transaction.aggregate({
        where: baseWhere,
        _sum: {
            price: true,
            profit: true,
            profitAmount: true,
        },
        _count: {
            id: true,
        },
        _avg: {
            price: true,
        },
        }),

        // Aggregate stats untuk deposits
        !transactionType || transactionType === 'DEPOSIT'
        ? this.prisma.deposit.aggregate({
          where: {
              createdAt : {
                  gte: startDateTime,
                  lte: endDateTime,
              },
            },
            _sum: {
                amount: true,
            },
            _count: {
                id: true,
            },
            _avg: {
                amount: true,
            },
            })
        : null,

        // Daily stats untuk transactions - FIXED: Pass Date objects instead of strings
        this.getDailyTransactionStats(startDateTime, endDateTime, transactionType, status, username),

        // Daily stats untuk deposits - FIXED: Pass Date objects instead of strings
        !transactionType || transactionType === 'DEPOSIT'
        ? this.getDailyDepositStats(startDateTime, endDateTime, status, username)
        : [],
    ]);

    // Process results
    const result: AnalyticsResult = {
        totalTransactions: 0,
        totalAmount: 0,
        totalProfit: 0,
        averageAmount: 0,
        transactionsByType: {
        MEMBERSHIP: 0,
        DEPOSIT: 0,
        TOPUP: 0,
        },
        transactionsByStatus: {},
        dailyStats: [],
    };

    // Combine transaction stats
    if (transactionStats) {
        result.totalTransactions += transactionStats._count.id || 0;
        result.totalAmount += transactionStats._sum.price || 0;
        result.totalProfit += transactionStats._sum.profitAmount || 0;
    }

    // Combine deposit stats
    if (depositStats) {
        result.totalTransactions += depositStats._count.id || 0;
        result.totalAmount += depositStats._sum.amount || 0;
    }

    // Calculate average
    result.averageAmount = result.totalTransactions > 0 
        ? result.totalAmount / result.totalTransactions 
        : 0;

    // Count by transaction type
    transactions.forEach((t: any) => {
        const type = t.transactionType?.toUpperCase() as keyof typeof result.transactionsByType;
        if (type && result.transactionsByType[type] !== undefined) {
        result.transactionsByType[type]++;
        }
        
        // Count by status
        result.transactionsByStatus[t.status] = (result.transactionsByStatus[t.status] || 0) + 1;
    });

    deposits.forEach((d: any) => {
        result.transactionsByType.DEPOSIT++;
        result.transactionsByStatus[d.status] = (result.transactionsByStatus[d.status] || 0) + 1;
    });

    // Combine daily stats
    const dailyStatsMap = new Map<string, any>();
    
    // Process transaction daily stats
    (dailyTransactionStats as any[]).forEach(stat => {
        const dateKey = stat.date.toISOString().split('T')[0];
        dailyStatsMap.set(dateKey, {
        date: dateKey,
        count: Number(stat.count),
        amount: Number(stat.amount),
        profit: Number(stat.profit),
        });
    });

  // Process deposit daily stats
  (dailyDepositStats as any[]).forEach(stat => {
    const dateKey = stat.date.toISOString().split('T')[0];
    const existing = dailyStatsMap.get(dateKey);
    if (existing) {
      existing.count += Number(stat.count);
      existing.amount += Number(stat.amount);
    } else {
      dailyStatsMap.set(dateKey, {
        date: dateKey,
        count: Number(stat.count),
        amount: Number(stat.amount),
        profit: 0,
      });
    }
  });

  result.dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  return result;
}

// Helper method untuk daily transaction stats - FIXED
private async getDailyTransactionStats(
  startDate: Date, 
  endDate: Date, 
  transactionType?: string, 
  status?: string, 
  username?: string
) {
  const conditions = [];
  
  // Format dates properly for PostgreSQL
  const startDateStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
  const endDateStr = endDate.toISOString().split('T')[0] + ' 23:59:59';
  
  conditions.push(`created_at >= '${startDateStr}'`);
  conditions.push(`created_at <= '${endDateStr}'`);
  
  if (transactionType && transactionType !== 'DEPOSIT') {
    conditions.push(`transaction_type = '${transactionType}'`);
  }
  
  if (status) {
    conditions.push(`status = '${status}'`);
  }
  
  if (username) {
    conditions.push(`username = '${username}'`);
  }

  const query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(price), 0) as amount,
      COALESCE(SUM(profit_amount), 0) as profit
    FROM transactions 
    WHERE ${conditions.join(' AND ')}
    GROUP BY DATE(created_at)
    ORDER BY date
  `;

  return await this.prisma.$queryRawUnsafe(query);
}


private async getDailyDepositStats(
  startDate: Date, 
  endDate: Date, 
  status?: string, 
  username?: string
) {
  const conditions = [];
  
  // Format dates properly for PostgreSQL
  const startDateStr = startDate.toISOString().split('T')[0] + ' 00:00:00';
  const endDateStr = endDate.toISOString().split('T')[0] + ' 23:59:59';
  
  conditions.push(`created_at >= '${startDateStr}'`);
  conditions.push(`created_at <= '${endDateStr}'`);
  
  if (status) {
    conditions.push(`status = '${status}'`);
  }
  
  if (username) {
    conditions.push(`username = '${username}'`);
  }

  const query = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(amount), 0) as amount,
      0 as profit
    FROM deposits 
    WHERE ${conditions.join(' AND ')}
    GROUP BY DATE(created_at)
    ORDER BY date
  `;


  return await this.prisma.$queryRawUnsafe(query);
}
  async getAnalyticsByType(
    startDate: Date,
    endDate: Date,
    transactionType?: string,
    status?: string,
  ) {
    return this.getAnalytics({
      startDate,
      endDate,
      transactionType,
      status,
    });
  }

  async getTopProducts(filter: AnalyticsFilter, limit: number = 10) {
  const { startDate, endDate, status, username } = filter;

  // Build where conditions untuk TOPUP saja
  const whereConditions: Prisma.TransactionWhereInput = {
    createdAt: {
      gte: new Date(startDate),
      lte: new Date(endDate)
    },
    transactionType: 'TOPUP' // Fokus ke TOPUP saja
  };

  if (status) {
    whereConditions.status = status;
  }

  if (username) {
    whereConditions.username = username;
  }

  const transactions = await this.prisma.transaction.findMany({
    where: whereConditions,
    select: {
      serviceName: true,
      price: true,
      profitAmount: true,
      username: true
    }
  });

  const productStats = new Map();

  transactions.forEach(transaction => {
    const productName = transaction.serviceName;
    
    if (!productStats.has(productName)) {
      productStats.set(productName, {
        product_name: productName,
        transaction_count: 0,
        total_amount: 0,
        total_profit: 0,
        unique_users: new Set()
      });
    }

    const stats = productStats.get(productName);
    stats.transaction_count++;
    stats.total_amount += transaction.price || 0;
    stats.total_profit += transaction.profitAmount || 0;
    stats.unique_users.add(transaction.username);
  });

  // Convert Set to count dan sort berdasarkan transaction_count
  const topProducts = Array.from(productStats.values())
    .map(stats => ({
      product_name: stats.product_name,
      transaction_count: stats.transaction_count,
      total_amount: stats.total_amount,
      total_profit: stats.total_profit,
      unique_users: stats.unique_users.size,
      average_amount: stats.total_amount / stats.transaction_count
    }))
    .sort((a, b) => b.transaction_count - a.transaction_count)
    .slice(0, limit);

  return topProducts;
  }
  async getActiveUsers(filter: AnalyticsFilter, limit: number = 20) {
  const { startDate, endDate, transactionType, status } = filter;

  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);

  const userStats = new Map();

  // Jika tidak ada filter transactionType atau include TOPUP
  if (!transactionType || transactionType === 'TOPUP') {
    const topupTransactions = await this.prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDateTime,
          lte: endDateTime
        },
        transactionType: 'TOPUP',
        ...(status && { status })
      },
      select: {
        username: true,
        price: true,
        profitAmount: true,
        createdAt: true
      }
    });

    topupTransactions.forEach(transaction => {
      const username = transaction.username;
      
      if (!userStats.has(username)) {
        userStats.set(username, {
          username: username,
          topup_count: 0,
          topup_amount: 0,
          topup_profit: 0,
          deposit_count: 0,
          deposit_amount: 0,
          total_transactions: 0,
          total_amount: 0,
          last_activity: transaction.createdAt
        });
      }

      const stats = userStats.get(username);
      stats.topup_count++;
      stats.topup_amount += transaction.price || 0;
      stats.topup_profit += transaction.profitAmount || 0;
      stats.total_transactions++;
      stats.total_amount += transaction.price || 0;
      
      // Update last activity jika lebih baru
      if (transaction.createdAt > stats.last_activity) {
        stats.last_activity = transaction.createdAt;
      }
    });
  }

  // Jika tidak ada filter transactionType atau include DEPOSIT
  if (!transactionType || transactionType === 'DEPOSIT') {
    const deposits = await this.prisma.deposit.findMany({
      where: {
        createdAt: {
          gte: startDateTime,
          lte: endDateTime
        },
        ...(status && { status })
      },
      select: {
        username: true,
        amount: true,
        createdAt: true
      }
    });

    deposits.forEach(deposit => {
      const username = deposit.username;
      
      if (!userStats.has(username)) {
        userStats.set(username, {
          username: username,
          topup_count: 0,
          topup_amount: 0,
          topup_profit: 0,
          deposit_count: 0,
          deposit_amount: 0,
          total_transactions: 0,
          total_amount: 0,
          last_activity: deposit.createdAt
        });
      }

      const stats = userStats.get(username);
      stats.deposit_count++;
      stats.deposit_amount += deposit.amount || 0;
      stats.total_transactions++;
      stats.total_amount += deposit.amount || 0;
      
      // Update last activity jika lebih baru
      if (deposit && deposit.createdAt as Date  > stats.last_activity) {
        stats.last_activity = deposit.createdAt;
      }
    });
  }

  // Sort berdasarkan total_transactions dan ambil top users
  const activeUsers = Array.from(userStats.values())
    .sort((a, b) => b.total_transactions - a.total_transactions)
    .slice(0, limit);

  return activeUsers;
}


  async getTopServices(filter: AnalyticsFilter, limit: number = 10) {
    const { startDate, endDate, transactionType, status, username } = filter;
  
    if (transactionType === 'DEPOSIT') {
      return [];
    }
  
    // Build where conditions
    const whereConditions: Prisma.TransactionWhereInput = {
      createdAt: {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    };
  
    if (transactionType) {
      whereConditions.transactionType = transactionType.toLowerCase()
    }

  if (status) {
    whereConditions.status = status;
  }

  if (username) {
    whereConditions.username = username;
  }

  // Get all transactions that match the filter
  const transactions = await this.prisma.transaction.findMany({
    where: whereConditions,
    select: {
      serviceName: true,
      price: true,
      profitAmount: true
    }
  });

  const serviceStats = new Map();

  transactions.forEach(transaction => {
    const serviceName = transaction.serviceName;
    
    if (!serviceStats.has(serviceName)) {
      serviceStats.set(serviceName, {
        service_name: serviceName,
        transaction_count: 0,
        total_amount: 0,
        total_profit: 0
      });
    }

    const stats = serviceStats.get(serviceName);
    stats.transaction_count++;
    stats.total_amount += transaction.price || 0;
    stats.total_profit += transaction.profitAmount || 0;
  });

  const topServices = Array.from(serviceStats.values())
    .sort((a, b) => b.transaction_count - a.transaction_count)
    .slice(0, limit);

  return topServices;
  }
  
  async getUserActivityBreakdown(filter: AnalyticsFilter, limit: number = 10) {
  const activeUsers = await this.getActiveUsers(filter, limit);

  return activeUsers.map(user => ({
    username: user.username,
    activity_summary: {
      total_transactions: user.total_transactions,
      total_amount: user.total_amount,
      last_activity: user.last_activity
    },
    topup_activity: {
      count: user.topup_count,
      amount: user.topup_amount,
      profit_generated: user.topup_profit,
      average_topup: user.topup_count > 0 ? user.topup_amount / user.topup_count : 0
    },
    deposit_activity: {
      count: user.deposit_count,
      amount: user.deposit_amount,
      average_deposit: user.deposit_count > 0 ? user.deposit_amount / user.deposit_count : 0
    }
  }));
}

// 4. Method untuk mendapatkan kombinasi product dan user analytics
async getProductUserAnalytics(filter: AnalyticsFilter, productLimit: number = 10, userLimit: number = 10) {
  const [topProducts, activeUsers] = await Promise.all([
    this.getTopProducts(filter, productLimit),
    this.getActiveUsers(filter, userLimit)
  ]);

  return {
    top_products: topProducts,
    active_users: activeUsers,
    summary: {
      total_unique_products: topProducts.length,
      total_active_users: activeUsers.length,
      top_product_revenue: topProducts[0]?.total_amount || 0,
      most_active_user_transactions: activeUsers[0]?.total_transactions || 0
    }
  };
}

// 5. Method untuk daily user activity (siapa yang aktif per hari)
async getDailyUserActivity(filter: AnalyticsFilter) {
  const { startDate, endDate, transactionType, status } = filter;
  
  const startDateTime = new Date(startDate);
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);

  const conditions = [];
  const startDateStr = startDateTime.toISOString().split('T')[0] + ' 00:00:00';
  const endDateStr = endDateTime.toISOString().split('T')[0] + ' 23:59:59';
  
  conditions.push(`created_at >= '${startDateStr}'`);
  conditions.push(`created_at <= '${endDateStr}'`);
  
  if (status) {
    conditions.push(`status = '${status}'`);
  }

  let query = '';
  
  if (!transactionType || transactionType === 'TOPUP') {
    query = `
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT username) as unique_users,
        COUNT(*) as total_transactions,
        COALESCE(SUM(price), 0) as total_amount,
        'TOPUP' as transaction_type
      FROM transactions 
      WHERE ${conditions.join(' AND ')} AND transaction_type = 'TOPUP'
      GROUP BY DATE(created_at)
    `;
  }

  if (!transactionType || transactionType === 'DEPOSIT') {
    const depositQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT username) as unique_users,
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        'DEPOSIT' as transaction_type
      FROM deposits 
      WHERE ${conditions.join(' AND ')}
      GROUP BY DATE(created_at)
    `;
    
    query = query ? `${query} UNION ALL ${depositQuery}` : depositQuery;
  }

  query += ' ORDER BY date, transaction_type';

  return await this.prisma.$queryRawUnsafe(query);
}

}
