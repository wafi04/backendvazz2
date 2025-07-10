import { BASE_URL, DUITKU_API_KEY, DUITKU_MERCHANT_CODE, FRONTEND_URL, TRANSACTION_FLOW } from "../../constants"
import { DuitkuService } from "../../lib/duitku"
import { AdminTransactionLogger } from "../../lib/logger"
import { prisma } from "../../lib/prisma"
import { ServiceData } from "../../types/service"
import { UserResponse } from "../../types/user"
import { ValidationMethodPayment } from "../../utils/calculateFeeMethod"
import { CalculatePricingWithProfitLogic } from "../../utils/calculateProice"
import { GenerateRandomId } from "../../utils/generate"
import { AuthService } from "../users/auth"
import { VoucherService } from "../voucher/voucher"
import { PaymentUsingSaldo } from "./paymentUsingSaldo"

interface CreateOrderTransaction {
    productCode: string
    methodCode: string
    gameId: string
    zone?: string
    voucherCode?: string
    whatsAppNumber: string
    nickname: string
    username?: string
    ip?  :  string
    userAgent? : string
}


export async function OrderTransactions(data: CreateOrderTransaction) {
    const { gameId, methodCode, nickname, productCode, whatsAppNumber, ip,userAgent,voucherCode, zone, username } = data
  
    const orderId = GenerateRandomId("VAZZ");
    const logger = new AdminTransactionLogger()
    const userService = new AuthService()
    const voucherService = new VoucherService()
    const duitku = new DuitkuService(DUITKU_API_KEY as string, DUITKU_MERCHANT_CODE as string)
    
    let user: UserResponse | null = null

    try {
        // Log transaction start
        await logger.logTransaction({
            orderId,
            transactionType: 'CREATE',
            status: 'STARTED',
            userId: gameId,
            productCode,
            paymentMethod: methodCode,
            data: { ...data, orderId },
            timestamp: new Date(),
        });

        // Get user if username provided
        if (username) {
            user = await userService.getUserByUsername(username)
        }

        // Execute transaction
        const result = await prisma.$transaction(
            async (tx) => {
                // Find product
                const product = await tx.service.findFirst({
                    where: {
                        providerId: productCode,
                    },
                });

                if (!product) {
                    throw new Error("Product not found")
                }
                
                // Calculate pricing
                const calculatePricing = CalculatePricingWithProfitLogic(
                    product as ServiceData,
                    user?.role
                );                
                
                let priceAmount: number = Math.round(calculatePricing.price);
                let totalAmount: number = calculatePricing.price;
                let fee: number = 0;
                let feeRupiah: number = 0;
                let discountAmount = 0;
                let profitAmount: number = calculatePricing.profitRupiah;

                // Handle voucher validation
                if (voucherCode) {
                    const validated = await voucherService.validateVoucher({
                        amount: priceAmount,
                        code: voucherCode,
                        categoryId: product.categoryId,
                        orderId,
                        username: user?.username,
                        whatsapp: user?.whatsapp as string,
                    });

                    if (!validated) {
                        throw new Error("Failed to validate voucher")
                    }

                    await voucherService.useVoucher(
                        validated.voucher.id,
                        orderId,
                        priceAmount,
                        user?.username,
                        user?.whatsapp as string
                    );

                    discountAmount = validated.discountAmount;
                    totalAmount = validated.finalAmount;
                }

                // Handle SALDO payment
                if (methodCode === "SALDO") {
                    if (!user) {
                        throw new Error("User authentication required for SALDO payment")
                    }

                    const saldoResult = await PaymentUsingSaldo({
                        amount: totalAmount,
                        noWa: whatsAppNumber,
                        orderId,
                        productCode: productCode,
                        productName: product.serviceName,
                        tx,
                        userId: gameId,
                        username: user.username,
                        serverId: zone,
                    });

                    await logger.logTransaction({
                        orderId,
                        transactionType: 'CREATE',
                        status: saldoResult.status ? 'PAID' : 'FAILED',
                        userId: gameId,
                        amount: totalAmount,
                        paymentMethod: 'SALDO',
                        data: saldoResult,
                        timestamp: new Date(),
                    });

                
                    return {
                        data: {
                            orderId,
                            productName: product.serviceName,
                            amount: priceAmount,
                            discount: discountAmount,
                            finalAmount: totalAmount,
                            paymentMethod: "SALDO",
                            timestamp: new Date().toISOString(),
                            transactionDetails: saldoResult.data,
                        },
                    };
                }

                // Handle other payment methods
                const method = await ValidationMethodPayment({
                    amount: totalAmount,
                    paymentCode: methodCode,
                    tx,
                });

                if (!method.method) {
                    throw new Error("Payment method not found or not available")
                }

                totalAmount = method.totalAmount;
                fee =  methodCode === "NQ" ? 0.007 : 0;
                feeRupiah = method.taxAmount;
                profitAmount = calculatePricing.profitRupiah - method.taxAmount;

                // Create Duitku transaction
                const toDuitku = await duitku.CreateTransaction({
                    paymentAmount: Math.max(totalAmount, 0),
                    paymentCode: methodCode,
                    merchantOrderId: orderId,
                    productDetails: product.serviceName,
                    callbackUrl: process.env.DUITKU_CALLBACK_URL,
                    returnUrl: `${FRONTEND_URL}/invoice?invoice=${orderId}`,
                    cust: user?.username,
                    noWa: whatsAppNumber,
                });

                if (!toDuitku || !toDuitku.status) {
                    throw new Error(toDuitku?.message || "Failed to create payment gateway transaction")
                }

                // Log payment creation
                await logger.logTransaction({
                    orderId,
                    transactionType: 'CREATE',
                    status: 'PENDING',
                    userId: gameId,
                    ip,
                    position : "AFTER FROM DUITKU",
                    productCode,
                    userAgent,
                    amount: totalAmount,
                    paymentMethod: method.method.name,
                    reference: toDuitku.data.reference,
                    data: toDuitku.data,
                    timestamp: new Date(),
                });

                const log = {
                    ...toDuitku.data,
                    message: "Pembelian Pending",
                };

                const payment = await tx.payment.create({
                    data: {
                        totalAmount: totalAmount,
                        orderId: orderId,
                        price: priceAmount.toString(),
                        method: method.method.name,
                        buyerNumber: whatsAppNumber,
                        feeAmount: feeRupiah,
                        fee,
                        status: TRANSACTION_FLOW.PENDING,
                        reference: toDuitku.data.reference,
                        paymentNumber: toDuitku.data.qrString || toDuitku.data.vaNumber || toDuitku.data.paymentUrl,
                        createdAt: new Date(),
                    },
                });


                // Create transaction record
                await tx.transaction.create({
                    data: {
                        profitAmount,
                        price: priceAmount,
                        profit: calculatePricing.profit,
                        isDigi: "active",
                        serviceName: product.serviceName,
                        status: TRANSACTION_FLOW.PENDING,
                        log: JSON.stringify(log),
                        discount: discountAmount,
                        purchasePrice: product.priceFromDigi,
                        nickname,
                        orderId : payment.orderId,
                        transactionType: "TOPUP",
                        userId: gameId,
                        zone,
                        successReportSent: "inactive",
                        providerOrderId: productCode,
                        message: "Pembelian Pending",
                        username: user?.username,
                        createdAt: new Date(),
                    },
                });

             
                const transactionResult = {
                        orderId,
                        productName: product.serviceName,
                        amount: priceAmount,
                        discount: discountAmount,
                        fee: feeRupiah,
                        finalAmount: totalAmount,
                        paymentMethod: method.method.name,
                        paymentUrl: toDuitku.data.paymentUrl,
                        reference: toDuitku.data.reference,
                        qrString: toDuitku.data.qrString,
                        vaNumber: toDuitku.data.vaNumber,
                        timestamp: new Date().toISOString(),
                };

                await logger.logTransaction({
                    userAgent,
                    ip,
                    productCode,
                    amount : 0,
                    data : transactionResult,
                    paymentMethod : methodCode,
                    orderId,
                    transactionType: 'CREATE',
                    status: 'PENDING',
                    position : "AFTER INSERT DB",
                    userId: gameId,
                    timestamp: new Date(),
                });

                return transactionResult;
            },
            {
                timeout: 30000,
            }
        );

        return result;

    } catch (error) {
        await logger.logTransaction({
            orderId,
            transactionType: 'CREATE',
            status: 'FAILED',
            userAgent,
            ip,
            productCode,
            amount : 0,
            data,
            position: "FAILED",
            paymentMethod : methodCode,
            userId: gameId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
        });

        return {
            data : null
        }
    }
}