import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

// mutasi balance
export class ExportToExcel {
  async MemberExport() {
    return await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        balance: true,
        role: true,
        lastActiveAt: true,
        lastPaymentAt: true,
        isOnline : true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async Transaction(
    createdAt: string,
    endDate: string,
    status: string,
    search: string
  ) {
    const where: Prisma.TransactionWhereInput = {};
    if (createdAt && endDate) {
        where.createdAt = {
          gte: new Date(createdAt),
          lte: new Date(endDate),
        };
      } else if (createdAt) {
        where.createdAt = {
          gte: new Date(createdAt),
        };
      } else if (endDate) {
        where.createdAt = {
          lte: new Date(endDate),
        };
      }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          username: search,
        },
        {
          orderId: search,
        },
        {
          userId: search,
        },
      ];
    }
    console.log(where)

    return prisma.transaction.findMany({
      where,
      select : {
        id: true,
          orderId: true,
          username: true,
          serviceName: true,
          price: true,
          status: true,
          serialNumber: true,
          createdAt: true,
          transactionType : true,
          updatedAt: true,
          userId: true,
          profitAmount: true,
          nickname : true,
          zone : true,
          payment: {
            select: {
              status: true,
              method: true,
              feeAmount: true,
              buyerNumber : true,
              totalAmount: true
            }
          }
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  // data deposit
  async Deposit(
    createdAt: string,
    endDate: string,
    status: string,
    search: string
  ) {
    const where: Prisma.DepositWhereInput = {};

    if (createdAt) {
      where.OR = [
        {
          createdAt: {
            gte: new Date(createdAt),
          },
        },
      ];
    }

    if (endDate) {
      where.OR = [
        {
          createdAt: {
            lte: new Date(endDate),
          },
        },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        {
          username: search,
        },
        {
          depositId: search,
        },
      ];
    }

    return prisma.deposit.findMany({
      where,
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}
