import { Prisma } from "@prisma/client";
import { Digiflazz } from "../../lib/digiflazz";
import { prisma } from "../../lib/prisma";
import { AdminTransactionLogger } from "../../lib/logger";
import { SyncBalanceWithUpsert } from "./refund/balance";

interface CallbackData {
  merchantCode: string;
  amount: number;
  refId: string;
  merchantOrderId: string;
  resultCode: string;
  signature: string;
}

interface TransactionResult {
  type: "success" | "error";
  message: string;
  data?: any;
}

interface Transaction {
  orderId: string;
  transactionType: string;
  providerOrderId: string | null;
  userId: string | null;
  zone: string | null;
  username: string | null;
  price: number;
}

interface Membership {
  name: string | null;
  price: number;
}

interface ServiceResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  statusCode: number;
}

// Service Class
export class DuitkuCallbackService {
  private digiflazz: Digiflazz;

  constructor(digiUsername: string, digiKey: string) {
    this.digiflazz = new Digiflazz(digiUsername, digiKey);
  }

  // Validate callback data
  private validateCallbackData(callbackData: CallbackData): string[] {
    const missingFields: string[] = [];
    
    if (!callbackData.merchantCode) missingFields.push("merchantCode");
    if (!callbackData.merchantOrderId) missingFields.push("merchantOrderId");
    if (!callbackData.amount || callbackData.amount <= 0) missingFields.push("amount");
    if (!callbackData.signature) missingFields.push("signature");
    if (!callbackData.resultCode) missingFields.push("resultCode");

    return missingFields;
  }

  private async handleTopUpTransaction(
    tx: Prisma.TransactionClient,
    transaction: Transaction,
    callbackData: CallbackData
  ): Promise<TransactionResult> {
    const logger = new AdminTransactionLogger()
    const topUpParams = {
      productCode: transaction.providerOrderId as string,
      reference: transaction.orderId,
      userId: transaction.userId as string,
      serverId: transaction.zone as string,
    };

    const toDigi = await this.digiflazz.TopUp(topUpParams);

    if (toDigi && toDigi?.data) {
      if (toDigi.data.status === "Pending" || toDigi.data.status === "Success") {
        const log = {
          ...toDigi.data,
          message: "Pesanan Sedang Dalam Pemrosesan",
        };

        await tx.transaction.update({
          where: { orderId: transaction.orderId },
          data: {
            purchasePrice : toDigi.data.price,
            refId: toDigi.data.ref_id,
            log: JSON.stringify(toDigi.data),
            message: log.message,
            status: "PROCESS",
          },
        });

        await SyncBalanceWithUpsert({
          amount : toDigi.data.price,
          orderId : transaction.orderId,
          paymentMethod : "FROM DIGI",
          platformName : "Digiflazz",
          tx
        })
        
        await logger.logTransaction({
            orderId : transaction.orderId,
            transactionType: 'PROCESS',
            status: 'PROCESS',
            userId: transaction.userId as string,
            position : "AFTER DIGIFLAZZ",
            productCode : transaction.providerOrderId as string,
            data: toDigi.data,
            timestamp: new Date(),
        });

        return {
          type: "success",
          message: "Create Transaction to duitku successfully",
          data: toDigi,
        };
      } else {
        if (transaction.username) {
          await tx.transaction.update({
            where: { orderId: transaction.orderId },
            data: {
              log: JSON.stringify(toDigi.data),
              message: "Pesanan Anda Gagal,Uang Anda Sudah Masuk Saldo Akun",
              status: "FAILED",
            },
          });
          
          // Refund to user balance
          await tx.user.update({
            where: { username: transaction.username },
            data: {
              balance: { increment: transaction.price },
            },
          });
          
        await logger.logTransaction({
            orderId : transaction.orderId,
            transactionType: 'ERROR',
            status: 'FAILED',
            userId: transaction.userId as string,
            position : "AFTER DIGIFLAZZ",
            productCode : transaction.providerOrderId as string,
            data: toDigi.data,
            timestamp: new Date(),
        });
          
          return {
            type: "error",
            message: "Order Failed,Silahkan Hubungi Admin",
            data: transaction,
          };
        } else {
    
          await tx.transaction.update({
            where: { orderId: transaction.orderId },
            data: {
              log: JSON.stringify(toDigi.data),
              message: "Pesanan Anda Gagal,Silahkan Hubungi Admin",
              status: "FAILED",
            },
          });
           await logger.logTransaction({
            orderId : transaction.orderId,
            transactionType: 'ERROR',
            status: 'FAILED',
            userId: transaction.userId as string,
            position : "AFTER DIGIFLAZZ",
            productCode : transaction.providerOrderId as string,
            data: toDigi.data,
            timestamp: new Date(),
        });
          
          return {
            type: "error",
            message: "Order Failed,Silahkan Hubungi Admin",
            data: transaction,
          };
        }
      }
    }
    
    throw new Error("Failed to process top-up transaction");
  }

  // Handle DEPOSIT transaction
  private async handleDepositTransaction(
    tx: Prisma.TransactionClient,
    transaction: Transaction,
    amount: number
  ): Promise<TransactionResult> {
    const deposit = await tx.deposit.update({
      where: { depositId: transaction.orderId },
      data: { status: "PAID" },
    });

    await tx.user.update({
      where: { username: deposit.username },
      data: {
        balance: { increment: parseInt(amount.toString()) },
      },
    });

    return {
      type: "success",
      message: "Deposit Berhasil",
    };
  }

  // Handle MEMBERSHIP transaction
  private async handleMembershipTransaction(
    tx: Prisma.TransactionClient,
    transaction: Transaction,
    amount: number
  ): Promise<TransactionResult> {
    const membershipFields: Membership | null = await tx.membership.findFirst({
      where: { price: parseInt(amount.toString()) },
    });

    if (membershipFields && transaction.username) {
      await tx.user.update({
        where: { username: transaction.username },
        data: { role: membershipFields.name as string },
      });
    } else {
      console.log("⚠️ No membership found or no username");
    }

    return {
      type: "success",
      message: "Membership Successfully",
    };
  }

  // Main process method
  async processCallback(callbackData: CallbackData): Promise<ServiceResponse> {
    try {
      const logger = new AdminTransactionLogger()
      // Validate input
      const missingFields = this.validateCallbackData(callbackData);
      if (missingFields.length > 0) {
        return {
          success: false,
          message: "Missing required fields",
          data: { missingFields, receivedData: callbackData },
          statusCode: 400,
        };
      }

      const { merchantOrderId,  amount } = callbackData;
      // Process transaction
      const result: TransactionResult = await prisma.$transaction(async (tx) => {
        // Find transaction
        const transaction: Transaction | null = await tx.transaction.findUnique({
          where: { orderId: merchantOrderId },
          select: {
            orderId: true,
            transactionType: true,
            providerOrderId: true,
            userId: true,
            zone: true,
            username: true,
            price: true,
          },
        });

        if (!transaction) {
          throw new Error("Transaction not found");
        }
         await logger.logTransaction({
            orderId : transaction.orderId,
            transactionType: 'PAYMENT',
            status: 'PAID',
            userId: transaction.userId ?? "" as string,
            position : "AFTER DIGIFLAZZ",
            productCode : transaction.providerOrderId ?? "" as string,
            data: callbackData,
            timestamp: new Date(),
        });

        await tx.transaction.update({
          where: { orderId: merchantOrderId },
          data: {
            status: "PAID",
            log: JSON.stringify(callbackData),
            message: "Payment successful",
          },
        });

        // Update payment status
       const payment =  await tx.payment.update({
          where: { orderId: merchantOrderId },
          data: {
            status: "PAID",
            updatedAt: new Date(),
          },
        });


        await SyncBalanceWithUpsert({
          amount : transaction.price - (payment.feeAmount ?? 0),
          orderId : merchantOrderId,
          paymentMethod :  payment.method,
          platformName : "Duitku",
          tx
        })

        switch (transaction.transactionType) {
          case "TOPUP":
            return await this.handleTopUpTransaction(tx, transaction, callbackData);
          
          case "DEPOSIT":
            return await this.handleDepositTransaction(tx, transaction, amount);
          
          default:
            return await this.handleMembershipTransaction(tx, transaction, amount);
        }
      });

      if (result.type === "success") {
        return {
          success: true,
          message: result.message,
          data: result.data,
          statusCode: 201,
        };
      } else {
        return {
          success: false,
          message: result.message,
          data: result.data,
          statusCode: 400,
        };
      }

    } catch (error: unknown) {
      return {
        success: false,
        message: "Error processing callback",
        data: { error: error instanceof Error ? error.message : "Unknown error" },
        statusCode: 500,
      };
    }
  }
}

// Factory function for easy instantiation
export function createDuitkuCallbackService(digiUsername: string, digiKey: string) {
  return new DuitkuCallbackService(digiUsername, digiKey);
}

// Helper function for parsing different content types
export class CallbackDataParser {
  static async parseJSON(jsonData: any): Promise<CallbackData> {
    return {
      merchantCode: jsonData.merchantCode,
      amount: parseInt(jsonData.amount),
      refId: jsonData.refId,
      merchantOrderId: jsonData.merchantOrderId,
      resultCode: jsonData.resultCode,
      signature: jsonData.signature,
    };
  }

  static async parseFormData(formData: FormData): Promise<CallbackData> {
    const formObject: { [key: string]: any } = {};
    
    Array.from(formData.entries()).forEach(([key, value]) => {
      formObject[key] = value;
    });

    return {
      merchantCode: String(formObject.merchantCode || formObject.merchant_code),
      amount: parseInt(String(formObject.amount || 0)),
      refId: String(formObject.refId || formObject.ref_id),
      merchantOrderId: String(formObject.merchantOrderId || formObject.merchant_order_id),
      resultCode: String(formObject.resultCode || formObject.result_code),
      signature: String(formObject.signature),
    };
  }

  static async parseURLEncoded(urlEncodedData: string): Promise<CallbackData> {
    const urlParams = new URLSearchParams(urlEncodedData);
    const paramObject: { [key: string]: string } = {};

    urlParams.forEach((value, key) => {
      paramObject[key] = value;
    });

    return {
      merchantCode: paramObject.merchantCode || paramObject.merchant_code || "",
      amount: parseFloat(paramObject.amount || "0"),
      refId: paramObject.refId || paramObject.ref_id || "",
      merchantOrderId: paramObject.merchantOrderId || paramObject.merchant_order_id || "",
      resultCode: paramObject.resultCode || paramObject.result_code || "",
      signature: paramObject.signature || "",
    };
  }
}