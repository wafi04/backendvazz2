import { Prisma } from "@prisma/client"
import { prisma } from "../../lib/prisma"

interface CreateSession {
    token : string
    username : string
    deviceInfo : string
    ip : string
    userAgent : string
    sessionId : string
}
export class SessionService {
    async Create(tx: Prisma.TransactionClient, data: CreateSession) {
    const session = await tx.session.create({
        data: {
        id: data.sessionId,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 hari
        sessionToken: data.token,
        deviceInfo: data.deviceInfo,
        ip: data.ip,
        username: data.username,
        userAgent: data.userAgent,
        }
    });

    await tx.user.update({
        where: { username: data.username },
        data: {
        isOnline: true,
        lastActiveAt: new Date()
        }
    });

    return session;
    }

    async VerifySession(sessionToken : string){
        return await prisma.session.findUnique({
            where : {
                sessionToken
            },
            select : {
                id :  true
            }
        })
    }


    async GetSession(id : string){
        const data = await prisma.session.findUnique({
            where : {
                id
            },
            select : {
                user : {
                    select : {
                        id: true,
                        name: true,
                        username: true,
                        role:true,
                        balance: true,
                        isOnline : true,
                        whatsapp : true,
                        createdAt: true,
                    }
                }
            }
        })

        return data
    }
}   