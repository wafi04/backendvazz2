import { Hono } from "hono";
import { ExportToExcel } from "../services/dataExport/service";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const exportRoutes =  new Hono()
const exportService = new ExportToExcel()



exportRoutes.get("/transactions",authMiddleware,adminMiddleware,async (c)  => {
try {
    const { startDate, endDate, status, search } = c.req.query()
    console.log(c.req.query())
    const transaction = await exportService.Transaction(startDate,endDate,status,search)

    return c.json({
        data : transaction,
        message : "Transaction retreived Successfully",
        success :  true
    },200)
} catch (error) {
     return c.json({
        error : error instanceof Error ? error.message : error,
        message : "Transaction Failed Received",
        success :  true
    },500)
}
})



exportRoutes.get("/deposit",authMiddleware,adminMiddleware,async (c)  => {
try {
    const {createdAt,endDate,status,search} = c.req.query()
    const transaction = await exportService.Deposit(createdAt,endDate,status,search)

    return c.json({
        data : transaction,
        message : "Deposit retreived Successfully",
        success :  true
    },200)
} catch (error) {
     return c.json({
        error : error instanceof Error ? error.message : error,
        message : "Deposit Failed Received",
        success :  true
    },500)
}
})



exportRoutes.get("/members",authMiddleware,adminMiddleware,async (c)  => {
try {
    const transaction = await exportService.MemberExport()

    return c.json({
        data : transaction,
        message : "Member retreived Successfully",
        success :  true
    },200)
} catch (error) {
     return c.json({
        error : error instanceof Error ? error.message : error,
        message : "Deposit Failed Received",
        success :  true
    },500)
}
})


export default exportRoutes


