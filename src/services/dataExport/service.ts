import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

// mutasi balance
export class ExportToExcel {
  async MemberExport() {
    return await prisma.user.findMany({
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
          orderId: search,
        },
        {
          userId: search,
        },
      ];
    }

    return prisma.transaction.findMany({
      where,
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
