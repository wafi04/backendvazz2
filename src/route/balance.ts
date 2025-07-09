import { Hono } from "hono";
import { BalanceService } from "../services/balance/service";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const balanceService = new BalanceService()
const balanceRoute = new Hono()

// GET /balance - Get all active platform balances
balanceRoute.get('/',authMiddleware,adminMiddleware, async (c) => {
    try {
        const balances = await balanceService.findAll()
        return c.json({
            success: true,
            data: balances,
            message: 'Balances retrieved successfully'
        })
    } catch (error) {
        return c.json({
            success: false,
            message: 'Failed to retrieve balances',
            error: error instanceof Error ? error.message : error
        }, 500)
    }
})

// GET /balance/:id - Get balance by ID with histories
balanceRoute.get('/:id',authMiddleware,adminMiddleware, async (c) => {
    try {
        const id = parseInt(c.req.param('id'))
        
        if (isNaN(id)) {
            return c.json({
                success: false,
                message: 'Invalid ID format'
            }, 400)
        }

        const balance = await balanceService.findById(id)
        
        if (!balance) {
            return c.json({
                success: false,
                message: 'Balance not found'
            }, 404)
        }

        return c.json({
            success: true,
            data: balance,
            message: 'Balance retrieved successfully'
        })
    } catch (error) {
        return c.json({
            success: false,
            message: 'Failed to retrieve balance',
            error: error instanceof Error ? error.message : error
        }, 500)
    }
})

// POST /balance - Create new platform balance
balanceRoute.post('/', authMiddleware,adminMiddleware, async (c) => {
    try {
        const body = await c.req.json()
        
        // Validate required fields
        if (!body.platformName || !body.accountName) {
            return c.json({
                success: false,
                message: 'platformName and accountName are required'
            }, 400)
        }

        const balance = await balanceService.create(body)
        
        return c.json({
            success: true,
            data: balance,
            message: 'Balance created successfully'
        }, 201)
    } catch (error) {
        return c.json({
            success: false,
            message: 'Failed to create balance',
            error: error instanceof Error ? error.message : error
        }, 500)
    }
})

// GET /balance/histories - Get balance histories with filtering and pagination
balanceRoute.get('/histories', authMiddleware,adminMiddleware, async (c) => {
    try {
        const query = c.req.query()
        
        const filter = {
            startDate: query.startDate,
            endDate: query.endDate,
            limit: query.limit || '10',
            page: query.page || '1',
            search: query.search,
            platformId: query.platformId
        }

        const histories = await balanceService.findHistories({ filter })
        
        return c.json({
            success: true,
            data: histories,
            message: 'Balance histories retrieved successfully'
        })
    } catch (error) {
        return c.json({
            success: false,
            message: 'Failed to retrieve balance histories',
            error: error instanceof Error ? error.message : error
        }, 500)
    }
})

// DELETE /balance/:id - Soft delete balance (set to inactive)
balanceRoute.delete('/:id', authMiddleware,adminMiddleware, async (c) => {
    try {
        const id = parseInt(c.req.param('id'))
        
        if (isNaN(id)) {
            return c.json({
                success: false,
                message: 'Invalid ID format'
            }, 400)
        }

        // Check if balance exists first
        const existingBalance = await balanceService.findById(id)
        if (!existingBalance) {
            return c.json({
                success: false,
                message: 'Balance not found'
            }, 404)
        }

        const deletedBalance = await balanceService.delete(id)
        
        return c.json({
            success: true,
            data: deletedBalance,
            message: 'Balance deleted successfully'
        })
    } catch (error) {
        return c.json({
            success: false,
            message: 'Failed to delete balance',
            error: error instanceof Error ? error.message : error
        }, 500)
    }
})

export default balanceRoute 