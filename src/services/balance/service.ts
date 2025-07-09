import { Prisma } from "@prisma/client"
import { prisma } from "../../lib/prisma"
import { PaginationUtil } from "../../utils/pagination"

export type CreateBalance = {
  platformName: string
  accountName: string
  accountNumber?: string
  balance?: number
}

export type UpdateBalance = Partial<CreateBalance> & {
  id: number
}

export class BalanceService {
    async create(data : CreateBalance){
        return await prisma.platformBalance.create({
            data : {
                ...data,
                isActive : "active"
            }
        })
    }

    async findAll() {
        const data =await prisma.platformBalance.findMany({
            where: {
                isActive: 'active',
            },
        })
        return data

    }

    async findById(id: number) {
        return await prisma.platformBalance.findUnique({
        where: { id },
        include: {
            balanceHistories: true,
            },
        })
    }



    async findHistories({
        filter
    } : {
        filter : {
            startDate? : string
            endDate? : string
            limit : string
            page : string
            search? : string
            platformId? : string
        }
    }) {
        const where: Prisma.BalanceHistoryWhereInput = {}
        const {endDate,limit,page,startDate,search,platformId}  = filter

        if(startDate){
            where.createdAt = {
                gte : new Date(startDate),
            }
        }

        if(endDate){
            where.createdAt = {
                lte : new Date(endDate),
            }
        }

        const {take,skip,currentPage,itemsPerPage}  = PaginationUtil.calculatePagination(
            limit,
            page
        )

        if(search){
            where.OR = [
                {
                    batchId  : search
                },
                {
                    changeType : search
                }
            ]
        }

        if(platformId){
              where.platformId = parseInt(platformId)
        }
        const [balanceHistories, total] = await Promise.all([
            prisma.balanceHistory.findMany({
                where,
                orderBy: {
                createdAt: "desc",
                },
                skip,
                take
            }),
            prisma.balanceHistory.count({ where }),
            ]);

             const result = PaginationUtil.createPaginatedResponse(
                balanceHistories,
                currentPage,
                itemsPerPage,
                total
            )

            return result

        }
    
    async delete(id: number) {
    return await prisma.platformBalance.update({
        where: { id },
        data: {
            isActive: 'inactive',
        },
      })
    }
}