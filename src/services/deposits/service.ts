import { Deposit, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { PaginationUtil } from "../../utils/pagination";

export class DepositService {
  
  async getDepositByUser(username : string): Promise<Deposit[]> {
      const req = await prisma.deposit.findMany({
          where: {
              OR: [
                  {
                       username
                  },
                  {
                      NOT: {
                          status : "deleted"
                      }
                  }
              ]  
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      return req
    }
    
    
    async getAllDepositUser({
        data
    }: {
            data: {
                limit: number
                page: number
                status : string
                search : string
        }
        }) {
         const { skip, take, currentPage, itemsPerPage } = PaginationUtil.calculatePagination(
            data.page.toString(), 
            data.limit.toString()
         )
        const where: Prisma.DepositWhereInput = {}
        
        if (data.status) {
            where.status = data.status
        }
        if (data.search) {
            where.OR = [
                {
                    depositId : data.search
                },
                {
                    username : data.search
                }
            ]
        }
const [vouchers, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (data.page - 1) * data.limit,
        take: data.limit,
      }),
      prisma.deposit.count({ where }),
    ]);

     const result = PaginationUtil.createPaginatedResponse(
        vouchers,
        currentPage,
        itemsPerPage,
        total
      )

        return result
    }


    async DeleteDepositByID(id : number) {
        const req = await prisma.deposit.update({
            where: { id }, data: {
            status : "deleted"
        }})
        return req
    }
}