import { Hono } from "hono";
import { UserAnalyticsService } from "../services/users/anayltics";

const userAnalytics = new Hono()
const userAnalyticsService = new UserAnalyticsService()

userAnalytics.get('/analytics', async (c) => {
    try {
        const {
            limit = '50',
            offset = '0',
            sortBy = 'last_active',
            filterStatus = "online"
        } = c.req.query()

        const users = await userAnalyticsService.getUserActivityAnalytics(
            parseInt(limit),
            parseInt(offset),
            sortBy as 'last_active' | 'created' | 'sessions' | 'balance',
            filterStatus as 'online' | 'active' | 'inactive' | 'dormant' | 'new_user'
        );

        return c.json({
            success: true,
            data: users,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                total: users.length
            }
        });
    } catch (error) {
        console.error('Error fetching user analytics:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// GET /analytics/summary - Mendapatkan ringkasan aktivitas
userAnalytics.get('/analytics/summary', async (c) => {
    try {
        const summary = await userAnalyticsService.getActivitySummary();
        
        return c.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Error fetching activity summary:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// GET /analytics/trends - Mendapatkan tren aktivitas user
userAnalytics.get('/analytics/trends', async (c) => {
    try {
        const { days = '30' } = c.req.query();
        const trends = await userAnalyticsService.getUserActivityTrends(parseInt(days));
        
        return c.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Error fetching user trends:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// GET /analytics/inactive - Mendapatkan user yang tidak aktif
userAnalytics.get('/analytics/inactive', async (c) => {
    try {
        const { days = '30' } = c.req.query();
        const inactiveUsers = await userAnalyticsService.getInactiveUsers(parseInt(days));
        
        return c.json({
            success: true,
            data: inactiveUsers,
            count: inactiveUsers.length
        });
    } catch (error) {
        console.error('Error fetching inactive users:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// POST /analytics/user/:username/set-offline - Set user menjadi offline
userAnalytics.post('/analytics/user/:username/set-offline', async (c) => {
    try {
        const { username } = c.req.param();
        await userAnalyticsService.setUserOffline(username);
        
        return c.json({
            success: true,
            message: `User ${username} set to offline`
        });
    } catch (error) {
        console.error('Error setting user offline:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// GET /analytics/user/:username - Mendapatkan detail analytics user tertentu
userAnalytics.get('/analytics/user/:username', async (c) => {
    try {
        const { username } = c.req.param();
        
        // Cari user berdasarkan username
        const users = await userAnalyticsService.getUserActivityAnalytics(1, 0, 'last_active');
        const user = users.find((u : any) => u.username === username);
        
        if (!user) {
            return c.json({
                success: false,
                message: 'User not found'
            }, 404);
        }
        
        return c.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user detail:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// GET /analytics/stats - Mendapatkan statistik cepat
userAnalytics.get('/analytics/stats', async (c) => {
    try {
        const summary = await userAnalyticsService.getActivitySummary();
        const inactiveUsers = await userAnalyticsService.getInactiveUsers(30);
        
        const stats = {
            totalUsers: summary.totalUsers,
            onlineUsers: summary.onlineUsers,
            activeUsers: summary.activeUsers,
            inactiveUsers: summary.inactiveUsers,
            dormantUsers: summary.dormantUsers,
            newUsers: summary.newUsers,
            averageDaysSinceLastActive: summary.averageDaysSinceLastActive,
            criticalInactiveUsers: inactiveUsers.filter((u : any) => u.daysSinceLastActive && u.daysSinceLastActive > 60).length,
            topActiveUser: summary.topActiveUsers[0] || null
        };
        
        return c.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})

// POST /analytics/user/:username/update-activity - Update aktivitas user manual
userAnalytics.post('/analytics/user/:username/update-activity', async (c) => {
    try {
        const { username } = c.req.param();
        await userAnalyticsService.updateLastActive(username);
        
        return c.json({
            success: true,
            message: `Activity updated for user ${username}`
        });
    } catch (error) {
        console.error('Error updating user activity:', error);
        return c.json({
            success: false,
            message: 'Internal server error'
        }, 500);
    }
})


export default userAnalytics;
