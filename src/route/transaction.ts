import { Hono } from "hono";
import { GetServices } from "../services/transaction/getServices";
import { TransactionFilters, TransactionService } from "../services/transaction/transaction";
import { adminMiddleware, authMiddleware } from "../middleware/auth";
import { ManualTransactions } from "../services/manual-transactions/server";
import { OrderTransactions } from "../services/transaction/order";

const transaction = new Hono()
// order 
const transactionService = new TransactionService();
const manualTransactons = new ManualTransactions();

// Routes
transaction.get('/sync',GetServices)
transaction.get("/", authMiddleware ,adminMiddleware,async (c) => {
    try {
        const filters: TransactionFilters = {
            page: c.req.query("page"),
            limit: c.req.query("limit"),
            search: c.req.query("search"),
            endDate: c.req.query("endDate"),
            startDate : c.req.query("startDate"),
            status: c.req.query("status"),
            transactionType: c.req.query("transactionType")
        };

        // Remove undefined values
        Object.keys(filters).forEach(key => {
            if (filters[key as keyof TransactionFilters] === undefined) {
                delete filters[key as keyof TransactionFilters];
            }
        });
        // Get transactions menggunakan filters yang sudah include pagination
        const result = await transactionService.getTransactions(filters);

        return c.json({
            success: true,
            message: "Transactions retrieved successfully",
            data : result
        });

    } catch (error) {
        return c.json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error"
        }, 500);
    }
});



transaction.get("/:orderId", async (c) => {
    try {
        const orderId = c.req.param("orderId");

        if (!orderId) {
            return c.json({
                success: false,
                message: "Order ID is required"
            }, 400);
        }

        const transaction = await transactionService.getTransactionById(orderId);

        if (!transaction) {
            return c.json({
                success: false,
                message: "Transaction not found"
            }, 404);
        }

        return c.json({
            success: true,
            message: "Transaction retrieved successfully",
            data: transaction
        });

    } catch (error) {
        console.error("Route error:", error);
        return c.json({
            success: false,
            message: "Internal server error",
            error: error instanceof Error ? error.message : "Unknown error"
        }, 500);
    }
});


transaction.post("/retransactions", authMiddleware, adminMiddleware, async (c) => {
    try {
        const req = await c.req.json();
        const result = await manualTransactons.Create(req)
        return c.json({
            success: true,
            message: "Transaction created successfully",
            data: result
        });
    } catch (error) {
        console.error("Route error:", error);
        return c.json({
            success: true,
            message: "Transaction failed successfully",
        });
    }
})


transaction.post("/order",async(c)   => {
    try {
        const req = await c.req.json()
        const result = await OrderTransactions(req)
        return c.json({
            success : true,
            message : "Transaction Created Successfully",
            data : result
        })
    } catch (error) {
           console.error("Route error:", error);
        return c.json({
            success: true,
            message: "Transaction failed successfully",
        });
    }
})


transaction.get("/manual/retransactions", authMiddleware, adminMiddleware, async (c) => {
    try {
        const result = await manualTransactons.GetAll(
            {
                createdBy: c.req.query("createdBy"),
                page: parseInt(c.req.query("page") as string),
                limit: parseInt(c.req.query("limit") as string),
                search: c.req.query("search"),
                status: c.req.query("status"),
            }
          
        )
        console.log(result)
        return c.json({
            success: true,
            message: "Transaction retreived successfully",
            data: result
        });
    } catch {
        return c.json({
            success: false,
            message: "Transaction failed successfully",
        });
    }
});

export default transaction