import { Deposit } from "@prisma/client";
import { prisma } from "../../lib/prisma";

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
    
    
    async getAllDepositUser() {
        const req = await prisma.deposit.findMany()
        return req
    }


    async DeleteDepositByID(id : number) {
        const req = await prisma.deposit.update({
            where: { id }, data: {
            status : "deleted"
        }})
        return req
    }
}