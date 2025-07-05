import { Prisma } from "@prisma/client"
import { prisma } from "../../lib/prisma"

interface UserActivityAnalytics {
    id: number
    name: string
    username: string
    role: string
    balance: number
    whatsapp: string | null
    isOnline: boolean
    createdAt: Date
    lastActiveAt: Date | null
    lastPaymentAt: Date
    daysSinceCreated: number
    daysSinceLastActive: number | null
    daysSinceLastPayment: number
    activityStatus: 'very_active' | 'active' | 'inactive' | 'dormant' | 'new_user'
    totalSessions: number
    avgSessionsPerDay: number
}

interface ActivitySummary {
    totalUsers: number
    onlineUsers: number
    activeUsers: number
    inactiveUsers: number
    dormantUsers: number
    newUsers: number
    averageDaysSinceLastActive: number
    topActiveUsers: UserActivityAnalytics[]
}

export class UserAnalyticsService {
    
   
        async getUserActivityAnalytics(
        limit: number = 50, 
        offset: number = 0,
        sortBy: 'last_active' | 'created' | 'sessions' | 'balance' = 'last_active',
        filterStatus?: 'online' | 'active' | 'inactive' | 'dormant' | 'new_user'
    ): Promise<UserActivityAnalytics[]> {
        
        // Build where conditions
        const whereConditions: any = {};
        
        if (filterStatus) {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            switch (filterStatus) {
                case 'online':
                    whereConditions.isOnline = true;
                    break;
                case 'active':
                    whereConditions.lastActiveAt = { gte: sevenDaysAgo };
                    whereConditions.isOnline = false;
                    break;
                case 'inactive':
                    whereConditions.lastActiveAt = { 
                        lt: sevenDaysAgo, 
                        gte: thirtyDaysAgo 
                    };
                    break;
                case 'dormant':
                    whereConditions.lastActiveAt = { lt: thirtyDaysAgo };
                    break;
                case 'new_user':
                    whereConditions.createdAt = { gte: sevenDaysAgo };
                    break;
            }
        }

        // Build order by
        let orderBy: any = {};
        switch (sortBy) {
            case 'last_active':
                orderBy = { lastActiveAt: 'desc' };
                break;
            case 'created':
                orderBy = { createdAt: 'desc' };
                break;
            case 'balance':
                orderBy = { balance: 'desc' };
                break;
            case 'sessions':
                // For sessions, we'll sort by created date as fallback
                orderBy = { createdAt: 'desc' };
                break;
        }

        const users = await prisma.user.findMany({
            where: whereConditions,
            orderBy,
            skip: offset,
            take: limit,
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                balance: true,
                whatsapp: true,
                isOnline: true,
                createdAt: true,
                lastActiveAt: true,
                lastPaymentAt: true,
                _count: {
                    select: {
                        session: true
                    }
                }
            }
        });

        return users.map(user => {
            const now = new Date();
            const daysSinceCreated = Math.floor((now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
            const daysSinceLastActive = user.lastActiveAt 
                ? Math.floor((now.getTime() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
                : null;
            const daysSinceLastPayment = Math.floor((now.getTime() - user.lastPaymentAt.getTime()) / (1000 * 60 * 60 * 24));
            
            let activityStatus = 'new_user';
            if (user.isOnline) {
                activityStatus = 'very_active';
            } else if (daysSinceLastActive === null) {
                activityStatus = 'new_user';
            } else if (daysSinceLastActive <= 7) {
                activityStatus = 'active';
            } else if (daysSinceLastActive <= 30) {
                activityStatus = 'inactive';
            } else {
                activityStatus = 'dormant';
            }

            const avgSessionsPerDay = daysSinceCreated > 0 
                ? user._count.session / daysSinceCreated 
                : 0;

            return {
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                balance: user.balance,
                whatsapp: user.whatsapp,
                isOnline: user.isOnline,
                createdAt: user.createdAt,
                lastActiveAt: user.lastActiveAt,
                lastPaymentAt: user.lastPaymentAt,
                daysSinceCreated,
                daysSinceLastActive,
                daysSinceLastPayment,
                activityStatus,
                totalSessions: user._count.session,
                avgSessionsPerDay: Math.round(avgSessionsPerDay * 100) / 100
            };
        });
    }


    async getActivitySummary(): Promise<ActivitySummary> {
        const summaryQuery = `
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN u.is_online = true THEN 1 ELSE 0 END) as online_users,
                SUM(CASE WHEN u.last_active_at IS NOT NULL AND EXTRACT(DAY FROM (NOW() - u.last_active_at)) <= 7 THEN 1 ELSE 0 END) as active_users,
                SUM(CASE WHEN u.last_active_at IS NOT NULL AND EXTRACT(DAY FROM (NOW() - u.last_active_at)) > 7 AND EXTRACT(DAY FROM (NOW() - u.last_active_at)) <= 30 THEN 1 ELSE 0 END) as inactive_users,
                SUM(CASE WHEN u.last_active_at IS NOT NULL AND EXTRACT(DAY FROM (NOW() - u.last_active_at)) > 30 THEN 1 ELSE 0 END) as dormant_users,
                SUM(CASE WHEN EXTRACT(DAY FROM (NOW() - u.created_at)) <= 7 THEN 1 ELSE 0 END) as new_users,
                ROUND(AVG(CASE WHEN u.last_active_at IS NOT NULL THEN EXTRACT(DAY FROM (NOW() - u.last_active_at)) END), 2) as avg_days_since_last_active
            FROM users u
        `;

        const [summary] = await prisma.$queryRaw<any[]>(Prisma.sql([summaryQuery]));
        
        // Get top 10 most active users
        const topActiveUsers = await this.getUserActivityAnalyticsORM(10, 0, 'last_active');

        return {
            totalUsers: parseInt(summary.total_users),
            onlineUsers: parseInt(summary.online_users),
            activeUsers: parseInt(summary.active_users),
            inactiveUsers: parseInt(summary.inactive_users),
            dormantUsers: parseInt(summary.dormant_users),
            newUsers: parseInt(summary.new_users),
            averageDaysSinceLastActive: parseFloat(summary.avg_days_since_last_active) || 0,
            topActiveUsers
        };
    }

    async getUserActivityTrends(days: number = 30): Promise<any[]> {
        const trendsQuery = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as new_users,
                COUNT(CASE WHEN last_active_at IS NOT NULL THEN 1 END) as active_users,
                AVG(balance) as avg_balance
            FROM users
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `;

        return await prisma.$queryRaw<any[]>(Prisma.sql([trendsQuery]));
    }

    async getInactiveUsers(daysSinceLastActive: number = 30): Promise<UserActivityAnalytics[]> {
        const inactiveQuery = `
            SELECT 
                u.id,
                u.name,
                u.username,
                u.role,
                u.balance,
                u.whatsapp,
                u.is_online as "isOnline",
                u.created_at as "createdAt",
                u.last_active_at as "lastActiveAt",
                u.last_payment_at as "lastPaymentAt",
                EXTRACT(DAY FROM (NOW() - u.created_at))::integer as days_since_created,
                EXTRACT(DAY FROM (NOW() - u.last_active_at))::integer as days_since_last_active,
                EXTRACT(DAY FROM (NOW() - u.last_payment_at))::integer as days_since_last_payment,
                'inactive' as activity_status,
                COALESCE(session_count.total_sessions, 0) as total_sessions,
                ROUND(COALESCE(session_count.total_sessions, 0)::numeric / EXTRACT(DAY FROM (NOW() - u.created_at))::numeric, 2) as avg_sessions_per_day
            FROM users u
            LEFT JOIN (
                SELECT username, COUNT(*) as total_sessions
                FROM sessions 
                GROUP BY username
            ) session_count ON u.username = session_count.username
            WHERE u.last_active_at IS NOT NULL 
            AND EXTRACT(DAY FROM (NOW() - u.last_active_at)) > $1
            ORDER BY u.last_active_at ASC
        `;

        const result = await prisma.$queryRaw<any[]>(
            Prisma.sql([inactiveQuery], daysSinceLastActive)
        );

        return result.map(row => ({
            id: row.id,
            name: row.name,
            username: row.username,
            role: row.role,
            balance: row.balance,
            whatsapp: row.whatsapp,
            isOnline: row.isOnline,
            createdAt: row.createdAt,
            lastActiveAt: row.lastActiveAt,
            lastPaymentAt: row.lastPaymentAt,
            daysSinceCreated: row.days_since_created,
            daysSinceLastActive: row.days_since_last_active,
            daysSinceLastPayment: row.days_since_last_payment,
            activityStatus: row.activity_status,
            totalSessions: row.total_sessions,
            avgSessionsPerDay: parseFloat(row.avg_sessions_per_day)
        }));
    }

    // Update existing SessionService to track last active
    async updateLastActive(username: string): Promise<void> {
        await prisma.$executeRaw`
            UPDATE users 
            SET last_active_at = NOW(), is_online = true 
            WHERE username = ${username}
        `;
    }

    async setUserOffline(username: string): Promise<void> {
        await prisma.$executeRaw`
            UPDATE users 
            SET is_online = false 
            WHERE username = ${username}
        `;
    }
}