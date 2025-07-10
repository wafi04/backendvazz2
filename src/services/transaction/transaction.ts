import { prisma } from "../../lib/prisma";
import { PaginatedResponse, PaginationParams, PaginationUtil } from "../../utils/pagination";

export interface TransactionFilters extends PaginationParams {
  search? : string
  status?: string;
  startDate?: string;
  endDate?: string;
  transactionType?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class TransactionService {
async getTransactions(
    filters: TransactionFilters = {}
): Promise<PaginatedResponse<any>> {
    const { page, limit, ...transactionFilters } = filters;
    const { skip, take, currentPage, itemsPerPage } = PaginationUtil.calculatePagination(page, limit);

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;


    if (transactionFilters.search) {
        whereConditions.push(`(t.order_id = $${paramIndex} OR t.user_id::text = $${paramIndex + 1})`);
        params.push(transactionFilters.search); 
        params.push(transactionFilters.search); 
        paramIndex += 2;
    }

    if (transactionFilters.startDate) {
    whereConditions.push(`t.created_at >= $${paramIndex}`); 
    params.push(new Date(transactionFilters.startDate));
    paramIndex++;
}

if (transactionFilters.endDate) {
    const endDate = new Date(transactionFilters.endDate);
    endDate.setHours(23, 59, 59, 999);
    whereConditions.push(`t.created_at <= $${paramIndex}`); 
    params.push(endDate);
    paramIndex++;
}


    if (transactionFilters.status) {
        whereConditions.push(`t.status = $${paramIndex}`);
        params.push(transactionFilters.status);
        paramIndex++;
    }

    if (transactionFilters.transactionType) {
        whereConditions.push(`t.transaction_type = $${paramIndex}`);
        params.push(transactionFilters.transactionType);
        paramIndex++;
    }

    const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    try {

        const countQuery = `
            SELECT COUNT(*) as total
            FROM transactions t
            LEFT JOIN payments p ON t.order_id = p.order_id
            ${whereClause}
        `;
        
        const countResult = await prisma.$queryRawUnsafe(countQuery, ...params) as any[];
        const totalItems = parseInt(countResult[0].total);


        const dataQuery = `
            SELECT 
                t.id,
                t.order_id,
                t.username,
                t.nickname,
                t.price,
                t.purchase_price,
                t.discount,
                t.user_id,
                t.zone,
                t.service_name,
                t.profit,
                t.profit_amount,
                t.status,
                t.log,
                t.transaction_type,
                t.is_digi,
                t.created_at,
                t.updated_at,
                p.payment_number,
                p.buyer_number,
                p.method as payment_method,
                p.total_amount,
                p.fee,
                p.fee_amount
            FROM 
                transactions t
            LEFT JOIN 
                payments p ON t.order_id = p.order_id
            ${whereClause}
            ORDER BY 
                t.created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        // Add LIMIT and OFFSET parameters
        const dataParams = [...params, take, skip];
        const result = await prisma.$queryRawUnsafe(dataQuery, ...dataParams) as any[];

        // Return paginated response menggunakan utility
        return PaginationUtil.createPaginatedResponse(
            result,
            currentPage,
            itemsPerPage,
            totalItems
        );

    } catch (error) {
        throw new Error('Failed to fetch transactions');
    }
}
    async getTransactionById(identifier: string): Promise<any | null> {
        try {
            const whereClause =  { orderId: identifier }

            const transaction = await prisma.transaction.findUnique({
                where: whereClause,
                select : {
                    updatedAt : true,
                    createdAt : true,
                    message : true,
                    orderId : true,
                    price : true,
                    status : true,
                    serialNumber : true,
                    serviceName : true,
                    username : true,
                    userId : true,
                    zone : true,
                    nickname : true,
                    payment : {
                        select : {
                            method : true,
                            paymentNumber : true,
                            status : true
                        }
                    }
                }
            });

            return transaction;
        } catch (error) {
            throw new Error('Failed to fetch transaction');
        }
    }
}