import { Hono } from "hono";
import { BalanceService } from "../services/balance/balance";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

export const balanceService = new BalanceService()
export const balanceRoute = new Hono()



balanceRoute.post("/", authMiddleware,adminMiddleware,async (c) => {
    try {
        const { 
            accountName,
            accountNumber,
            balance,
            platformName
        } = await c.req.json()
        const data = await balanceService.Create({
            accountName,
            accountNumber,
            balance,
            platformName
        })

        return c.json({
            data,
            success: true,
            message : "Create Balance transaction successfully"
        })
    } catch (error) {
        return c.json({
            message: "failed to create json",
            success: false
        },500)
    }
})


balanceRoute.get("/balance/:id", authMiddleware, adminMiddleware, async (c) => {
    try {
        const id = c.req.param()
        const data = await balanceService.findById(parseInt(id.id))

        return c.json({
            data,
            success: true,
            message : "Balance retreived successfully"
        })
    } catch (error) {
        return c.json({
            message: "failed to create json",
            success: false
        },500)
    }
})


balanceRoute.get("/", authMiddleware, adminMiddleware, async (c) => {
    try {
        const {startDate,endDate} = c.req.query()

        const data = await balanceService.findAll(startDate,endDate)

        return c.json({
            data,
            success: true,
            message : "Balance retreived successfully"
        })
    } catch (error) {
        return c.json({
            message: "failed to create json",
            success: false
        },500)
    }
})


export default balanceRoute