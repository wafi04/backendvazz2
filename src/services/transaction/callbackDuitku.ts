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

export class DuitkuCallbackService {
  private digiflazz: Digiflazz;
  private readonly DIGIFLAZZ_TIMEOUT = 45000; 

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


  private async checkDigiflazzProcessed(orderId: string): Promise<boolean> {
    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
      select: { refId: true, status: true }
    });

    return !!(transaction?.refId && transaction.refId !== "");
  }

  // Digiflazz API call dengan timeout dan error handling
  private async callDigiflazzWithTimeout(topUpParams: any): Promise<any> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Digiflazz API timeout after 45 seconds')), this.DIGIFLAZZ_TIMEOUT);
    });

    try {
      const result = await Promise.race([
        this.digiflazz.TopUp(topUpParams),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      console.error('Digiflazz API Error:', error);
      throw error;
    }
  }

  // STRICT: Handle TopUp dengan fail-fast approach
  private async handleTopUpTransaction(
    tx: Prisma.TransactionClient,
    transaction: Transaction,
    callbackData: CallbackData
  ): Promise<TransactionResult> {
    const logger = new AdminTransactionLogger();

    // CRITICAL: Check double processing prevention
    const isAlreadyProcessed = await this.checkDigiflazzProcessed(transaction.orderId);
    if (isAlreadyProcessed) {
      await logger.logTransaction({
        orderId: transaction.orderId,
        transactionType: 'BLOCKED',
        status: 'BLOCKED',
        userId: transaction.userId as string,
        position: "BEFORE_DIGIFLAZZ",
        productCode: transaction.providerOrderId as string,
        data: { message: "Transaction already processed, preventing double hit" },
        timestamp: new Date(),
      });

      return {
        type: "error",
        message: "Transaction already processed to Digiflazz",
        data: { orderId: transaction.orderId, status: "ALREADY_PROCESSED" },
      };
    }

    const topUpParams = {
      productCode: transaction.providerOrderId as string,
      reference: transaction.orderId,
      userId: transaction.userId as string,
      serverId: transaction.zone as string,
    };

    let toDigi: any;
    try {
      // SYNCHRONOUS: Hit Digiflazz dalam transaction
      toDigi = await this.callDigiflazzWithTimeout(topUpParams);
    } catch (error) {
      // FAIL FAST: Jika Digiflazz error, langsung fail
      const errorMessage = error instanceof Error ? error.message : "Digiflazz API Error";
      
      await tx.transaction.update({
        where: { orderId: transaction.orderId },
        data: {
          status: "FAILED",
          message: `Digiflazz Error: ${errorMessage}`,
          log: JSON.stringify({ 
            ...callbackData, 
            error: errorMessage,
            step: "digiflazz_error"
          }),
        },
      });

      // Refund balance jika ada username
      if (transaction.username) {
        await tx.user.update({
          where: { username: transaction.username },
          data: {
            balance: { increment: transaction.price },
          },
        });
      }

      // Log error
      await logger.logTransaction({
        orderId: transaction.orderId,
        transactionType: 'ERROR',
        status: 'FAILED',
        userId: transaction.userId as string,
        position: "DIGIFLAZZ_ERROR",
        productCode: transaction.providerOrderId as string,
        data: { error: errorMessage },
        timestamp: new Date(),
      });

      return {
        type: "error",
        message: `Digiflazz processing failed: ${errorMessage}`,
        data: { orderId: transaction.orderId, error: errorMessage },
      };
    }

    // Process hasil dari Digiflazz
    if (toDigi && toDigi?.data) {
      if (toDigi.data.status === "Pending" || toDigi.data.status === "Success") {
        const log = {
          ...toDigi.data,
          message: "Pesanan Berhasil Diproses ke Digiflazz",
        };

        await tx.transaction.update({
          where: { orderId: transaction.orderId },
          data: {
            purchasePrice: toDigi.data.price,
            refId: toDigi.data.ref_id,
            log: JSON.stringify(log),
            message: log.message,
            status: "PROCESS",
          },
        });

        await SyncBalanceWithUpsert({
          amount: toDigi.data.price,
          type : "descrease",
          orderId: transaction.orderId,
          paymentMethod: "FROM DIGI",
          platformName: "Digiflazz",
          tx
        });

        // Log success
        await logger.logTransaction({
          orderId: transaction.orderId,
          transactionType: 'PROCESS',
          status: 'PROCESS',
          userId: transaction.userId as string,
          position: "AFTER_DIGIFLAZZ",
          productCode: transaction.providerOrderId as string,
          data: toDigi.data,
          timestamp: new Date(),
        });

        return {
          type: "success",
          message: "TopUp berhasil diproses ke Digiflazz",
          data: toDigi,
        };
      } else {
        // Digiflazz return failed status
        await tx.transaction.update({
          where: { orderId: transaction.orderId },
          data: {
            log: JSON.stringify(toDigi.data),
            message: "Pesanan Gagal di Digiflazz, Saldo Sudah Dikembalikan",
            status: "FAILED",
          },
        });

        // Refund balance jika ada username
        if (transaction.username) {
          await tx.user.update({
            where: { username: transaction.username },
            data: {
              balance: { increment: transaction.price },
            },
          });
        }

        // Log failed
        await logger.logTransaction({
          orderId: transaction.orderId,
          transactionType: 'ERROR',
          status: 'FAILED',
          userId: transaction.userId as string,
          position: "DIGIFLAZZ_REJECTED",
          productCode: transaction.providerOrderId as string,
          data: toDigi.data,
          timestamp: new Date(),
        });

        return {
          type: "error",
          message: "TopUp ditolak oleh Digiflazz, balance sudah dikembalikan",
          data: toDigi,
        };
      }
    }

    // Jika sampai sini berarti response Digiflazz tidak valid
    throw new Error("Invalid response from Digiflazz");
  }

  // Handle DEPOSIT transaction
  private async handleDepositTransaction(
    tx: Prisma.TransactionClient,
    transaction: Transaction,
    amount: number,
    feeAmount: number
  ): Promise<TransactionResult> {
    const deposit = await tx.deposit.update({
      where: { depositId: transaction.orderId },
      data: { status: "PAID" },
    });

    await tx.user.update({
      where: { username: deposit.username },
      data: {
        balance: { increment: amount },
      },
    });

    await SyncBalanceWithUpsert({
      amount: transaction.price - feeAmount,
      orderId: transaction.orderId,
      paymentMethod: "test",
      platformName: "Saldo Member",
      tx
    });

    return {
      type: "success",
      message: "Deposit Berhasil",
    };
  }

  private async handleMembershipTransaction(
    tx: Prisma.TransactionClient,
    transaction: Transaction,
    amount: number,
    tax: number
  ): Promise<TransactionResult> {
    const membershipFields: Membership | null = await tx.membership.findFirst({
      where: { price: amount },
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

  // STRICT: Main process method dengan fail-fast
  async processCallback(callbackData: CallbackData): Promise<ServiceResponse> {
    const logger = new AdminTransactionLogger();
    
    try {
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

      const { merchantOrderId, amount } = callbackData;

      // Process dalam single transaction (ALL OR NOTHING)
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

        // Check if payment already processed
        const existingPayment = await tx.payment.findUnique({
          where: { orderId: merchantOrderId },
        });

        if (existingPayment?.status === "PAID") {
          throw new Error("Payment already processed");
        }

        // Log payment received
        await logger.logTransaction({
          orderId: transaction.orderId,
          transactionType: 'PAYMENT',
          status: 'PAID',
          userId: transaction.userId ?? "",
          position: "CALLBACK_RECEIVED",
          productCode: transaction.providerOrderId ?? "",
          data: callbackData,
          timestamp: new Date(),
        });

        // Update payment status
        const payment = await tx.payment.update({
          where: { orderId: merchantOrderId },
          data: {
            status: "PAID",
            updatedAt: new Date(),
          },
        });

        // Update transaction payment status
        await tx.transaction.update({
          where: { orderId: merchantOrderId },
          data: {
            status: "PAID",
            log: JSON.stringify(callbackData),
            message: "Payment successful",
          },
        });

        // Sync balance
        await SyncBalanceWithUpsert({
          amount: transaction.price - (payment.feeAmount ?? 0),
          orderId: merchantOrderId,
          paymentMethod: payment.method,
          platformName: "Duitku",
          tx
        });

        // Process berdasarkan transaction type
        switch (transaction.transactionType) {
          case "TOPUP":
            return await this.handleTopUpTransaction(tx, transaction, callbackData);
          
          case "DEPOSIT":
            return await this.handleDepositTransaction(tx, transaction, amount, payment.feeAmount ?? 0);
          
          default:
            return await this.handleMembershipTransaction(tx, transaction, amount, payment.feeAmount ?? 0);
        }
      }, {
        timeout: 60000, 
      });

      // Return response berdasarkan hasil
      return {
        success: result.type === "success",
        message: result.message,
        data: result.data,
        statusCode: result.type === "success" ? 200 : 400,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Log error
      logger.logTransaction({
        orderId: callbackData.merchantOrderId,
        transactionType: 'ERROR',
        status: 'ERROR',
        userId: "",
        position: "CALLBACK_ERROR",
        productCode: "",
        data: { error: errorMessage },
        timestamp: new Date(),
      }).catch(console.error);

      return {
        success: false,
        message: "Error processing callback",
        data: { error: errorMessage },
        statusCode: 500,
      };
    }
  }

  // Helper method untuk manual check double processing
  async checkTransactionStatus(orderId: string): Promise<{
    isProcessed: boolean;
    hasRefId: boolean;
    status: string;
    refId: string | null;
  }> {
    const transaction = await prisma.transaction.findUnique({
      where: { orderId },
      select: { status: true, refId: true }
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return {
      isProcessed: !!(transaction.refId && transaction.refId !== ""),
      hasRefId: !!(transaction.refId && transaction.refId !== ""),
      status: transaction.status,
      refId: transaction.refId,
    };
  }
}

// Factory function
export function createDuitkuCallbackService(digiUsername: string, digiKey: string) {
  return new DuitkuCallbackService(digiUsername, digiKey);
}

// Parser classes remain the same
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