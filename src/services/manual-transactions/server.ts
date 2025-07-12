import { DIGI_KEY, DIGI_USERNAME } from "../../constants";
import { Digiflazz } from "../../lib/digiflazz";
import { prisma } from "../../lib/prisma";

export class ManualTransactions {
async Create({
    data,
}: {
    data: {
        orderId: string;
        createdBy: string;
        reason: string;
    };
}) {
    const digiflazz = new Digiflazz(DIGI_USERNAME, DIGI_KEY);
    
    if (!data.orderId) {
        throw new Error("Order ID is required");
    }

    try {
        return await prisma.$transaction(async (tx) => {
            // 1. Cek apakah order ID ada di transactions table
            const transaction = await tx.transaction.findUnique({
                where: {
                    orderId: data.orderId
                },
                select: {
                    orderId: true,
                    providerOrderId: true,
                    userId: true,
                    zone: true,
                    refId: true,
                    serviceName: true,
                    priceDuitku : true,
                    price: true,
                    profit: true,
                    profitAmount: true,
                    nickname: true,
                    username: true,
                    payment : {
                        select : {
                            buyerNumber : true,
                            totalAmount : true,
                        }
                    }
                }
            });

            
            if (!transaction) {
                throw new Error("Order ID not found in transactions");
            }
            
            // 2. Generate manual transaction ID
            const manualTransactionId = `RE${data.orderId}`;

            // 3. Call Digiflazz API untuk check ID
            const toDigi = await digiflazz.TopUp({
                productCode: transaction.providerOrderId as string,
                userId: transaction.userId as string,
                reference : manualTransactionId as string,
                serverId: transaction.zone ?? "",
            });
            let newManualTransaction

            // 4. Insert ke manual_transaction table
            if (toDigi && toDigi.data) {
                newManualTransaction = await tx.manualTransaction.create({
                    data: {
                        orderId: data.orderId,
                        manualTransactionId: manualTransactionId,
                        userId: transaction.userId  as string,
                        nickname: transaction.nickname,
                        price: toDigi.data.price,
                        profitAmount: (transaction.priceDuitku ?? 0) - toDigi.data.price,
                        profit: transaction.profit,
                        zone: transaction.zone,
                        whatsapp: transaction.payment?.buyerNumber || "", 
                        productName: transaction.serviceName,
                        createdBy: data.createdBy,
                        reason: data.reason,
                        status: "PROCESS"
                    }
                });

                await tx.transaction.update({
                    where : {
                        orderId : data.orderId
                    },
                    data : {
                        profitAmount : (transaction.priceDuitku ?? 0) - toDigi.data.price,
                        purchasePrice : toDigi.data.price,
                        refId : manualTransactionId,
                        isReOrder : "active",
                        log : JSON.stringify(toDigi.data)
                    }
                })
                return {
                    message: "Manual transaction created successfully",
                    statusCode: 201,
                    success: true,
                    data: newManualTransaction,
                };
            } 
            return {
                message: "Failed to process manual transaction",
                success: false,
                statusCode: 400,
            };
        });
    } catch (error) {
        console.error('Manual transaction error:', error);
        throw error;
    }
}
    // Additional method to get manual transaction by ID
    async GetById(id: number) {
        try {
            const query = `
                SELECT 
                    mt.*,
                    t.service_name,
                    t.status as transaction_status
                FROM manual_transaction mt
                LEFT JOIN transactions t ON mt.order_id = t.order_id
                WHERE mt.id = $1
            `;
            
            const result = await prisma.$queryRawUnsafe(query, id) as any[];
            
            if (!result || result.length === 0) {
                return null;
            }
            
            return result[0];
        } catch (error) {
            console.error('Get manual transaction error:', error);
            throw error;
        }
    }

    // Method to get manual transactions with pagination
    async GetAll({
        page = 1,
        limit = 10,
        status,
        search,
        createdBy,
    }: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        createdBy?: string;
    } = {}) {
        try {
            const offset = (page - 1) * limit;
            let whereConditions: string[] = [];
            let params: any[] = [];
            let paramIndex = 1;

            if (status) {
                whereConditions.push(`mt.status = $${paramIndex}`);
                params.push(status);
                paramIndex++;
            }

            if (createdBy) {
                whereConditions.push(`mt.created_by = $${paramIndex}`);
                params.push(createdBy);
                paramIndex++;
            }

             if (search) {
                whereConditions.push(`mt.order_id = $${paramIndex}`);
                params.push(search);
                paramIndex++;
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Count query
            const countQuery = `
                SELECT COUNT(*) as total
                FROM manual_transaction mt
                ${whereClause}
            `;
            
            const countResult = await prisma.$queryRawUnsafe(countQuery, ...params) as any[];
            const totalItems = parseInt(countResult[0].total);

            // Data query
            const dataQuery = `
                SELECT 
                    mt.*,
                    t.service_name,
                    t.status as transaction_status
                FROM manual_transaction mt
                LEFT JOIN transactions t ON mt.order_id = t.order_id
                ${whereClause}
                ORDER BY mt.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            const dataParams = [...params, limit, offset];
            const result = await prisma.$queryRawUnsafe(dataQuery, ...dataParams) as any[];

            return {
                data: result,
                meta: {
                    currentPage: page,
                    totalPages: Math.ceil(totalItems / limit),
                    totalItems,
                    itemsPerPage: limit,
                    hasNextPage: page < Math.ceil(totalItems / limit),
                    hasPrevPage: page > 1,
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Method to update manual transaction status
    async UpdateStatus(id: number, status: string, serialNumber?: string) {
        try {
            const updateQuery = `
                UPDATE manual_transaction 
                SET 
                    status = $1, 
                    serial_number = COALESCE($2, serial_number),
                    updated_at = NOW() 
                WHERE id = $3
                RETURNING *
            `;
            
            const result = await prisma.$queryRawUnsafe(
                updateQuery,
                status,
                serialNumber,
                id
            ) as any[];
            
            if (!result || result.length === 0) {
                throw new Error("Manual transaction not found");
            }
            
            return result[0];
        } catch (error) {
            console.error('Update manual transaction status error:', error);
            throw error;
        }
    }
}