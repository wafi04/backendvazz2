import { prisma } from "../../lib/prisma";

class DepositAnalyticsService {
  
  // 1. Analytics by Status dengan Default Range (Hari Ini)
  async getTodayAnalytics() {
    const result = await prisma.$queryRaw<any[]>`
      SELECT 
        status,
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM deposits 
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'PENDING' THEN 1
          WHEN 'PROCESS' THEN 2  
          WHEN 'PAID' THEN 3
          WHEN 'SUCCESS' THEN 4
          ELSE 5
        END
    `;
    
    return this.formatAnalyticsResult(result);
  }

  // 2. Analytics by Status (Sebulan Terakhir)
  async getMonthlyAnalytics() {
    const result = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM deposits 
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 1 MONTH)
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'PENDING' THEN 1
          WHEN 'PROCESS' THEN 2  
          WHEN 'PAID' THEN 3
          WHEN 'SUCCESS' THEN 4
          ELSE 5
        END
    `;
    
    return this.formatAnalyticsResult(result as any[]);
  }

  // 3. Analytics by Status dengan Custom Date Range
  async getStatusAnalytics(startDate: string, endDate: string) {
    const result = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as total_count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM deposits 
      WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'PENDING' THEN 1
          WHEN 'PROCESS' THEN 2  
          WHEN 'PAID' THEN 3
          WHEN 'SUCCESS' THEN 4
          ELSE 5
        END
    `;
    
    return this.formatAnalyticsResult(result as any[]);
  }

  // 4. Analytics dengan Persentase
  async getAnalyticsWithPercentage(startDate: string, endDate: string) {
    const result = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage_count,
        ROUND(SUM(amount) * 100.0 / SUM(SUM(amount)) OVER(), 2) as percentage_amount
      FROM deposits 
      WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
      GROUP BY status
      ORDER BY count DESC
    ` as any[]
    
    return result.map(row => ({
      status: row.status,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
      percentageCount: Number(row.percentage_count),
      percentageAmount: Number(row.percentage_amount)
    }));
  }

  // 5. Analytics Harian dalam Range Date (Trend Analysis)
  async getDailyTrend(startDate: string, endDate: string) {
    const result = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM deposits 
      WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
      GROUP BY DATE(created_at), status
      ORDER BY date DESC, status
    ` as any []
    
    return result.map(row => ({
      date: row.date,
      status: row.status,
      count: Number(row.count),
      totalAmount: Number(row.total_amount)
    }));
  }

  // 6. Analytics by Method dan Status
  async getMethodStatusAnalytics(startDate: string, endDate: string) {
    const result = await prisma.$queryRaw`
      SELECT 
        method,
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount
      FROM deposits 
      WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
      GROUP BY method, status
      ORDER BY method, status
    ` as any[]
    
    return result.map(row => ({
      method: row.method,
      status: row.status,
      count: Number(row.count),
      totalAmount: Number(row.total_amount),
      avgAmount: Number(row.avg_amount)
    }));
  }

  // 7. Top Users by Deposit Amount
  async getTopUsersAnalytics(startDate: string, endDate: string, limit: number = 10) {
    const result = await prisma.$queryRaw`
      SELECT 
        username,
        status,
        COUNT(*) as total_deposits,
        SUM(amount) as total_amount
      FROM deposits 
      WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
      GROUP BY username, status
      HAVING SUM(amount) > 0
      ORDER BY total_amount DESC
      LIMIT ${limit}
    ` as any[]
    
    return result.map(row => ({
      username: row.username,
      status: row.status,
      totalDeposits: Number(row.total_deposits),
      totalAmount: Number(row.total_amount)
    }));
  }

  // 8. Hourly Analytics (untuk hari ini)
  async getHourlyAnalytics() {
    const result = await prisma.$queryRaw`
      SELECT 
        HOUR(created_at) as hour,
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM deposits 
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY HOUR(created_at), status
      ORDER BY hour, status
    ` as any[]
    
    return result.map(row => ({
      hour: Number(row.hour),
      status: row.status,
      count: Number(row.count),
      totalAmount: Number(row.total_amount)
    }))
  }

  // 9. Monthly Comparison (3 bulan terakhir)
  async getMonthlyComparison() {
    const result = await prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM deposits 
      WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m'), status
      ORDER BY month DESC, status
    ` as any[]
    
    return result.map(row => ({
      month: row.month,
      status: row.status,
      count: Number(row.count),
      totalAmount: Number(row.total_amount)
    }));
  }

  // 10. Summary Analytics
  async getSummaryAnalytics(startDate: string, endDate: string) {
    const [statusAnalytics, totalSummary] = await Promise.all([
      this.getAnalyticsWithPercentage(startDate, endDate),
      prisma.$queryRaw`
        SELECT 
          COUNT(*) as total_deposits,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount,
          MIN(amount) as min_amount,
          MAX(amount) as max_amount
        FROM deposits 
        WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
      ` as any
    ]);

    return {
      summary: {
        totalDeposits: Number(totalSummary[0].total_deposits),
        totalAmount: Number(totalSummary[0].total_amount),
        avgAmount: Number(totalSummary[0].avg_amount),
        minAmount: Number(totalSummary[0].min_amount),
        maxAmount: Number(totalSummary[0].max_amount),
        dateRange: {
          startDate: startDate,
          endDate: endDate
        }
      },
      statusBreakdown: statusAnalytics
    };
  }

  // 11. Status Flow Analysis (Processing Time) - FIXED
  async getStatusFlowAnalytics(startDate: string, endDate: string) {
    const result = await prisma.$queryRaw`
      SELECT 
        username,
        deposit_id,
        created_at as pending_time,
        updated_at as success_time,
        TIMESTAMPDIFF(MINUTE, created_at, updated_at) as processing_minutes
      FROM deposits 
      WHERE status = 'SUCCESS'
        AND created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
        AND updated_at IS NOT NULL
      ORDER BY processing_minutes DESC
    ` as any[]
    
    return result.map(row => ({
      username: row.username,
      depositId: row.deposit_id,
      pendingTime: row.pending_time,
      successTime: row.success_time,
      processingMinutes: Number(row.processing_minutes)
    }));
  }

  // 12. Revenue Analytics by Status
  async getRevenueAnalytics(startDate: string, endDate: string) {
    const result = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_revenue,
        MIN(amount) as min_revenue,
        MAX(amount) as max_revenue,
        STDDEV(amount) as revenue_stddev
      FROM deposits 
      WHERE created_at BETWEEN ${new Date(startDate)} AND ${new Date(endDate)}
        AND status IN ('SUCCESS', 'PAID')
      GROUP BY status
      ORDER BY total_revenue DESC
    ` as any[]
    
    return result.map(row => ({
      status: row.status,
      transactionCount: Number(row.transaction_count),
      totalRevenue: Number(row.total_revenue),
      avgRevenue: Number(row.avg_revenue),
      minRevenue: Number(row.min_revenue),
      maxRevenue: Number(row.max_revenue),
      revenueStddev: Number(row.revenue_stddev || 0)
    }));
  }

  // Helper method untuk format hasil analytics
  formatAnalyticsResult(result: any[]) {
    const statusOrder = ['PENDING', 'PROCESS', 'PAID', 'SUCCESS'];
    
    return statusOrder.map(status => {
      const data = result.find(item => item.status === status);
      return {
        status,
        totalCount: data ? Number(data.total_count) : 0,
        totalAmount: data ? Number(data.total_amount) : 0,
        avgAmount: data ? Math.round(Number(data.avg_amount)) : 0,
        minAmount: data ? Number(data.min_amount) : 0,
        maxAmount: data ? Number(data.max_amount) : 0
      };
    });
  }

  // Helper method untuk generate date range
  getDateRange(type: string) {
    const now = new Date();
    let startDate: Date, endDate: Date;

    switch (type) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'yesterday':
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        endDate = now;
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        endDate = now;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
  }
}

export default DepositAnalyticsService;