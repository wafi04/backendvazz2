import { prisma } from "../../lib/prisma"


export type CreateBalance = {
    platformName: string
    accountName: string
    accountNumber: string
    balance: number
}

export type UpdateBalance =  Partial<CreateBalance>
export class BalanceService {
    async Create(data : CreateBalance) {
        const create = await prisma.platformBalance.create({
            data: {
                ...data,
                isActive : "active"
            }
        })
        return create
    }

     async findById(id: number) {
        return await prisma.platformBalance.findUnique({
        where: { id },
        include: {
            balanceHistories: true,
        },
        })
     }
    async findAll(startDate: string, endDate: string) {
            return await prisma.platformBalance.findMany({
                // where: {
                // balanceHistories: {
                //     some: {
                //     createdAt: {
                //         gte: new Date(startDate),
                //         lte: new Date(endDate),
                //     },
                //     },
                // },
                // },
                // include: {
                // balanceHistories: {
                //     where: {
                //     createdAt: {
                //         gte: new Date(startDate),
                //         lte: new Date(endDate),
                //     },
                //     },
                // },
                // },
                include: {
                    balanceHistories : true
                }
        })
    }
    
    async update(id : number,data: UpdateBalance) {
        const { ...rest } = data
        return await prisma.platformBalance.update({
        where: { id },
        data: rest,
        })
  }

  // Soft Delete
  async delete(id: number) {
    return await prisma.platformBalance.update({
      where: { id },
      data: {
        isActive: 'inactive',
      },
    })
  }
}