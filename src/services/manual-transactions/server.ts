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
            whatsapp: string;
            userId: string;
            nickname: string;
            zone: string;
            productCode: string;
            productName: string;
            price: number;
            profit: number;
            profitAmount: number;
        };
    }) {
        const {
            orderId,
            createdBy,
            reason,
            whatsapp,
            userId,
            nickname,
            zone,
            productCode,
            productName,
            price,
            profit,
            profitAmount,
        } = data;

    const digiflazz = new Digiflazz(DIGI_USERNAME, DIGI_KEY);
        
        if (!orderId) {
            throw new Error("Order ID is required");
        }
        if (!data) {
            throw new Error("Data is required");
        }

        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Cek apakah order ID ada di transactions table
                const transactionCheckQuery = `
                    SELECT 
                        order_id, 
                        provider_order_id, 
                        user_id, 
                        zone, 
                        ref_id,
                        service_name,
                        price,
                        profit,
                        profit_amount
                    FROM transactions 
                    WHERE order_id = $1
                `;
                
                const transactionResult = await tx.$queryRawUnsafe(transactionCheckQuery, orderId) as any[];
                
                if (!transactionResult || transactionResult.length === 0) {
                    throw new Error("Order ID not found in transactions");
                }
                
                const transaction = transactionResult[0];
                
                // 2. Generate manual transaction ID
                const manualTransactionId = `RE${orderId}`;
                
                // 3. Insert ke manual_transaction table
                const insertManualTransactionQuery = `
                    INSERT INTO manual_transaction (
                        order_id,
                        manual_transaction_id,
                        user_id,
                        nickname,
                        price,
                        profit_amount,
                        profit,
                        zone,
                        whatsapp,
                        product_name,
                        created_by,
                        reason,
                        status,
                        created_at,
                        updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
                    )
                    RETURNING id, manual_transaction_id, status
                `;
                
                const insertResult = await tx.$queryRawUnsafe(
                    insertManualTransactionQuery,
                    orderId,
                    manualTransactionId,
                    userId,
                    nickname,
                    price || transaction.price,
                    profitAmount || transaction.profit_amount,
                    profit || transaction.profit,
                    zone || transaction.zone,
                    whatsapp,
                    productName,
                    createdBy,
                    reason,
                    "PENDING"
                ) as any[];
                
                const newManualTransaction = insertResult[0];
                
                // 4. Call Digiflazz API (assuming you have this import)
                const toDigi = await digiflazz.TopUp({
                    productCode: transaction.provider_order_id as string,
                    userId: transaction.user_id as string,
                    reference: transaction.ref_id as string,
                    serverId: transaction.zone ?? "",
                });
                
                // 5. Update status to PAID if successful
                if (toDigi && toDigi.data) {
                    // 5. Update status to PAID if successful
                    const updateSuccessQuery = `
                        UPDATE manual_transaction 
                        SET status = $1, updated_at = NOW() 
                        WHERE id = $2
                        RETURNING *
                    `;
                    
                    const updatedTransaction = await tx.$queryRawUnsafe(
                        updateSuccessQuery,
                        "PAID",
                        newManualTransaction.id
                    ) as any[];
                    
                    return {
                        message: "Manual transaction created successfully",
                        statusCode: 201,
                        success: true,
                        data: updatedTransaction[0],
                    };
                } else {
                    // 6. Update status to FAILED if API call fails
                    const updateFailedQuery = `
                        UPDATE manual_transaction 
                        SET status = $1, updated_at = NOW() 
                        WHERE id = $2
                        RETURNING *
                    `;
                    
                    const failedTransaction = await tx.$queryRawUnsafe(
                        updateFailedQuery,
                        "FAILED",
                        newManualTransaction.id
                    ) as any[];
                    
                    return {
                        message: "Failed to process manual transaction",
                        success: false,
                        statusCode: 400,
                        data: failedTransaction[0],
                    };
                }
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