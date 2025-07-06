import { Hono } from "hono";
import { DepositService } from "../services/deposits/service";
import { authMiddleware, adminMiddleware } from "../middleware/auth"; 
import { Deposit } from "../services/transaction/deposit";

const depositRoute = new Hono()
const deposit = new DepositService()

depositRoute.get("/user", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as {
      userId: number;
      username: string;
      role: string;
    };

    const deposits = await deposit.getDepositByUser(user.username);
    
    return c.json({
        success: true,
        message : "User deposits retrieved successfully",
        data: deposits
    });
  } catch (error) {
    console.error("Error getting user deposits:", error);
    return c.json({
      success: false,
      message: "Failed to get deposits"
    }, 500);
  }
});

depositRoute.post("/", authMiddleware, async (c) => {
  try {
    const user = c.get("jwtPayload") as {
      userId: number;
      username: string;
      role: string;
    };
    const { amount, code, totalAmount, type } = await c.req.json();
    const deposit = await Deposit({
      amount,
      code,
      totalAmount,
      username: user.username,
      type
    })
    return c.json({
      success: true,
      message: "Deposit created successfully",
      data: deposit
    });
  } catch (error) {
    console.error("Error creating deposit:", error);
    return c.json({
      success: false,
      message: "Failed to create deposit"
    }, 500)
  }
})


// Route untuk mendapatkan semua deposit (hanya admin yang bisa akses)
depositRoute.get("/all", authMiddleware, adminMiddleware, async (c) => {
  try {
    const {limit,page,status,search}= c.req.query()
    
    const deposits = await deposit.getAllDepositUser({
      data: {
        limit: parseInt(limit as string),
        page: parseInt(page as string),
        status: status,
        search : search
      }
    });
    
    return c.json({
        success: true,
        message: "All deposits retrieved successfully",
      data: deposits
    });
  } catch (error) {
    console.error("Error getting all deposits:", error);
    return c.json({
      success: false,
      message: "Failed to get all deposits"
    }, 500);
  }
});

// Route untuk menghapus deposit berdasarkan ID (hanya admin yang bisa akses)
depositRoute.delete("/:id", authMiddleware, adminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    
    if (isNaN(id)) {
      return c.json({
        success: false,
        message: "Invalid deposit ID"
      }, 400);
    }

    const deletedDeposit = await deposit.DeleteDepositByID(id);
    
    return c.json({
      success: true,
      message: "Deposit deleted successfully",
      data: deletedDeposit
    });
  } catch (error) {
    console.error("Error deleting deposit:", error);
    return c.json({
      success: false,
      message: "Failed to delete deposit"
    }, 500);
  }
});

export default   depositRoute 