import { BASE_URL, DUITKU_API_KEY, DUITKU_MERCHANT_CODE, FRONTEND_URL, TRANSACTION_FLOW } from "../../constants"
import { DuitkuService } from "../../lib/duitku"
import { prisma } from "../../lib/prisma"
import { ServiceData } from "../../types/service"
import { UserResponse } from "../../types/user"
import { ValidationMethodPayment } from "../../utils/calculateFeeMethod"
import { CalculatePricingWithProfitLogic } from "../../utils/calculateProice"
import { GenerateRandomId } from "../../utils/generate"
import { AuthService } from "../users/auth"
import { VoucherService } from "../voucher/voucher"
import { PaymentUsingSaldo } from "./paymentUsingSaldo"

interface CreateOrderTransation {
    productCode: string
    methodCode: string
    gameId: string
    zone?: string
    voucherCode?: string
    whatsAppNumber: string
    nickname: string
    username?: string
}
export async function OrderTransactions(data: CreateOrderTransation) {
    const { gameId, methodCode, nickname, productCode, whatsAppNumber, voucherCode, zone, username } = data

    const userService = new AuthService()
    const voucherService = new VoucherService()
    const duitku = new DuitkuService(DUITKU_API_KEY as string, DUITKU_MERCHANT_CODE as string)
    let user: UserResponse | null = null
    
    if (username) {
        user = await userService.getUserByUsername(username)
    }

    return await prisma.$transaction(
        async (tx) => {
            const product = await tx.service.findFirst({
                where: {
                    providerId: productCode,
                },
            });

            if (!product) {
                throw new Error("Product Not Found")
            }

            const calculatePricing = CalculatePricingWithProfitLogic(
                product as ServiceData,
                user?.role
            );                
            
            let priceAmount: number = Math.round(calculatePricing.price);
            let totalAmount: number = calculatePricing.price;
            let fee: number | null;
            let feeRupiah: number | null;
            let discountAmount = 0;
            let profitAmount: number = calculatePricing.profitRupiah;

            const orderId = GenerateRandomId("VAZZ")
            
            // Handle voucher validation
            if(voucherCode){
                const validated = await voucherService.validateVoucher(
                    {
                        amount : priceAmount,
                        code : voucherCode,
                        categoryId : product.categoryId,
                        orderId,
                        username : user?.username,
                        whatsapp : user?.whatsapp as string,
                    }
                )

                if (!validated){
                    throw new Error("failed to validated voucher")
                }

                await voucherService.useVoucher(
                    validated.voucher.id,
                    orderId,
                    priceAmount,
                    user?.username,
                    user?.whatsapp as string
                )

                discountAmount = validated.discountAmount,
                totalAmount = validated.finalAmount
            }

            // Handle SALDO payment
            if(methodCode === "SALDO" && user){
                const data = await PaymentUsingSaldo({
                    amount: totalAmount,
                    noWa : whatsAppNumber,
                    orderId,
                    productCode: productCode,
                    productName: product.serviceName,
                    tx,
                    userId: gameId,
                    username: user.username,
                    serverId: zone,
                });

                return {
                    status: data.status,
                    message: data.message,
                    code: data.status ? 200 : 400,
                    data: {
                        orderId,
                        productName: product.serviceName,
                        amount: priceAmount,
                        discount: discountAmount,
                        finalAmount: totalAmount,
                        paymentMethod: "SALDO",
                        timestamp: new Date().toISOString(),
                        transactionDetails: data.data,
                    },
                };
            } else {
                // Handle other payment methods
                const method = await ValidationMethodPayment({
                    amount: totalAmount,
                    paymentCode : methodCode,
                    tx,
                });
                console.log(method.taxAmount)
                totalAmount = method.totalAmount;
                fee = method.methodTax ?? 0;
                feeRupiah = method.taxAmount;
                profitAmount = calculatePricing.profitRupiah - method.taxAmount

                const toDuitku = await duitku.CreateTransaction({
                    paymentAmount: Math.max(totalAmount),
                    paymentCode : methodCode,
                    merchantOrderId : orderId,
                    productDetails: product.serviceName,
                    callbackUrl: `${BASE_URL}/callback/duitku`,
                    returnUrl: `${FRONTEND_URL}/invoice?invoice=${orderId}`,
                    cust: user?.username,
                    noWa : whatsAppNumber,
                });

                if (!toDuitku || !toDuitku.status) {
                    return {
                        status: false,
                        message: "Failed to create payment gateway transaction",
                        code: 500,
                        error: toDuitku?.message || "API connection error",
                    };
                }

                const log = {
                    ...toDuitku.data,
                    message: "Pembelian Pending",
                };

                try {
                     await tx.payment.create({
                        data: {
                            totalAmount: totalAmount,
                            orderId : orderId,
                            price: priceAmount.toString(),
                            method: method.method?.name ?? "",
                            buyerNumber: whatsAppNumber,
                            feeAmount: feeRupiah,
                            fee,
                            status: TRANSACTION_FLOW.PENDING,
                            reference: toDuitku.data.reference,
                            paymentNumber: toDuitku.data.qrString || toDuitku.data.vaNumber || toDuitku.data.paymentUrl,
                            createdAt: new Date(),
                        },
                    });

                    const pembelian = await tx.transaction.create({
                        data: {
                            profitAmount,
                            price : priceAmount,
                            profit: calculatePricing.profit,
                            isDigi: "active",
                            serviceName: product.serviceName,
                            status: TRANSACTION_FLOW.PENDING,
                            log: JSON.stringify(log),
                            discount: discountAmount,
                            purchasePrice: product.priceFromDigi,
                            nickname,
                            orderId,
                            transactionType: "TOPUP",
                            userId : gameId,
                            zone,
                            successReportSent: "inactive",
                            providerOrderId: productCode,
                            message: "Pembelian Pending",
                            username: user?.username as string,
                            createdAt: new Date(),
                        },
                    });

                   
                    return {
                        status: true,
                        message: "Transaction created successfully",
                        code: 200,
                        data: {
                            orderId,
                            productName: product.serviceName,
                            amount: priceAmount,
                            discount: discountAmount,
                            finalAmount: totalAmount,
                            fee: feeRupiah,
                            paymentMethod: method.method?.name,
                            paymentUrl: toDuitku.data.paymentUrl,
                            qrString: toDuitku.data.qrString,
                            vaNumber: toDuitku.data.vaNumber,
                            reference: toDuitku.data.reference,
                            timestamp: new Date().toISOString(),
                        },
                    };

                } catch (error) {
                    throw new Error("FAILED TO CREATE TRANSACTIONS: " + (error instanceof Error ? error.message : 'Unknown error'));
                }
            }
        }
    );
}