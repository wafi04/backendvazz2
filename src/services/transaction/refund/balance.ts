import { Prisma } from "@prisma/client"
import { AdminTransactionLogger } from "../../../lib/logger"

type SyncBalance = {
    tx: Prisma.TransactionClient
    orderId: string
    amount: number
    platformName: string
    paymentMethod: string
    type? : string
}

export async function SyncBalanceWithUpsert({ tx, orderId, amount, paymentMethod, platformName,type }: SyncBalance) {
    const logger = new AdminTransactionLogger()
    
    try {
        // 1. Validasi input parameters
        if (!orderId || !platformName || !paymentMethod) {
            throw new Error(`Missing required parameters: orderId=${orderId}, platformName=${platformName}, paymentMethod=${paymentMethod}`)
        }

        if (typeof amount !== 'number' || isNaN(amount)) {
            throw new Error(`Invalid amount: ${amount}`)
        }

        // 2. Cari platform balance yang sudah ada
        const existingPlatform = await tx.platformBalance.findUnique({
            where: { platformName }
        })

        const balanceBefore = existingPlatform?.balance || 0
        const balanceAfter = type === "decrease" ? balanceBefore - amount : balanceBefore + amount

        

        // 3. Upsert platform balance
        const updatedPlatform = await tx.platformBalance.upsert({
            where: {
                platformName: platformName,
            },
            update: {
                balance: balanceAfter,
                lastSyncAt: new Date(),
            },
            create: {
                platformName: platformName,
                accountName: `Account ${platformName}`, 
                balance: amount,
                lastSyncAt: new Date(),
            }
        })

        const historyData = {
            platformId: updatedPlatform.id,
            batchId: orderId,
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            amountChanged: amount,
            changeType: amount > 0 ? 'CREDIT' : 'DEBIT',
            description: `Balance sync for order ${orderId}`,
        }
        const sync = await tx.balanceHistory.create({
            data: historyData
        })

        const result = {
            success: true,
            platformName,
            balanceBefore,
            balanceAfter,
            amountChanged: amount,
            syncId: sync.id,
            platformId: updatedPlatform.id
        }

        return result

    } catch (error) {
        const errorLogData = {
            transactionType: "ERROR" as const,
            orderId,
            timestamp: new Date(),
            amount,
            data: JSON.stringify({
                error: error instanceof Error ? {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                } : error,
                input: {
                    orderId,
                    amount,
                    platformName,
                    paymentMethod
                }
            }),
            paymentMethod,
            status: "ERROR"
        }


        try {
            logger.logTransaction(errorLogData)
        } catch (logError) {
            console.error(`❌ Failed to log error:`, logError)
        }

        throw error
    }
}
