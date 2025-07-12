import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AdminTransactionLogger } from "../../lib/logger";

interface TransactionData {
  id: number;
  payment: {
    orderId: string;
    price: string;
  } | null;
  orderId: string;
  username: string | null;
  price: number;
  successReportSent: string;
}

interface CallbackData {
  data: {
    ref_id: string;
    buyer_sku_code: string;
    customer_no: string;
    status: string;
    message: string;
    sn: string;
  };
}

interface ServiceResponse {
  success: boolean;
  message: string;
  data?: any;
  status?: number;
}

export class DigiflazzCallbackService {
  static async processCallback(callbackData: CallbackData): Promise<ServiceResponse> {
    let referenceId: string = "UNKNOWN";
    const logger = new AdminTransactionLogger();
    
    try {
      // Validasi data callback yang diterima
      if (!callbackData || !callbackData.data) {
        return {
          success: false,
          message: "Invalid callback data format",
          status: 400,
        };
      }


      const { ref_id, status, message, sn } = callbackData.data;

      if (!ref_id) {
        return {
          success: false,
          message: "Missing reference ID",
          status: 400,
        };
      }

      referenceId = ref_id;

      await logger.logTransaction({
        orderId: ref_id,
        transactionType: 'CALLBACK',
        status: 'SUCCESS',
        position: "CALLBACK DIGIFLAZZ",
        data: { message: "Callback Digiflazz", data: callbackData.data },
        timestamp: new Date(),
      });

      const normalizedStatus = status ? status.trim().toLowerCase() : "";
      const purchaseStatus = normalizedStatus === "sukses" ? "SUCCESS" : "FAILED";

      // Use transaction to ensure data integrity
      const result = await prisma.$transaction(
        async (tx) => {
          // Find the pembelian record
          const pembelian: TransactionData | null = await tx.transaction.findFirst({
            where: { refId: referenceId },
            select: {
              id: true,
              orderId: true,
              username: true,
              priceDuitku : true,
              successReportSent: true,
              price: true,
              payment: {
                select: {
                  orderId: true,
                  price: true,
                },
              },
            },
          });

          if (!pembelian) {
            return {
              success: false,
              message: "Pembelian Not Found",
              data: {
                message: "Pembelian Not Found",
                rc: "14",
              },
              status: 400,
            };
          }

          let logMessage = message || "";
          let refundProcessed = false;

          if (purchaseStatus === "SUCCESS" && sn) {
            logMessage = messageLogs("SUCCESS", `SN/Kode Voucher: ${sn}`);
          }
          else if (purchaseStatus === "FAILED" && pembelian.username) {
            const harga = typeof pembelian.price === "string" 
              ? parseInt(pembelian.price, 10) 
              : pembelian.price;
              
            const user = await tx.user.findUnique({
              where: { username: pembelian.username },
              select: {
                id: true,
              },
            });

            if (user) {
              await tx.user.update({
                where: { id: user.id },
                data: {
                  balance: { increment: harga },
                },
              });
              logMessage = messageLogs("FAILED", "Saldo telah otomatis dikembalikan ke akun");
              refundProcessed = true;
            } else {
              logMessage = messageLogs("FAILED", "User tidak ditemukan, refund tidak dapat diproses");
            }
          }

          await tx.transaction.update({
            where: { id: pembelian.id },
            data: {
              status: purchaseStatus,
              serialNumber: sn || null,
              log: JSON.stringify(callbackData.data),
              message: logMessage,
              updatedAt: new Date(),
            },
          });


          if (purchaseStatus === "SUCCESS" && pembelian.successReportSent !== "DONE") {
            await tx.transaction.update({
              where: { id: pembelian.id },
              data: { successReportSent: "DONE" },
            });
            const manual = await tx.manualTransaction.findFirst({
              where : {
                manualTransactionId : ref_id
              }
            })
            if(manual){
              await tx.manualTransaction.update({
                where : {
                  id : manual.id
              },
              data : {
                  status: purchaseStatus,
                  serialNumber: sn || null,
                  updatedAt: new Date(),
              }
            })
          }
          }

          return {
            success: true,
            message: "Callback processed successfully",
            data: {
              ...pembelian,
              refundProcessed,
              finalStatus: purchaseStatus,
              logMessage,
            },
          };
        },
        {
          maxWait: 15000,
          timeout: 30000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      return result;
    } catch (error) {
      // Log error untuk debugging
      await logger.logTransaction({
        orderId: referenceId,
        transactionType: 'ERROR',
        status: 'ERROR',
        position: "CALLBACK DIGIFLAZZ ERROR",
        data: { 
          message: "Error processing callback", 
          error: error instanceof Error ? error.message : "Unknown error",
          callbackData: callbackData.data 
        },
        timestamp: new Date(),
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : "System error",
        status: 500,
      };
    } finally {
      await prisma.$disconnect();
    }
  }
}

export type message = "PENDING" | "PAID" | "FAILED" | "SUCCESS";

export function messageLogs(message: message, ket?: string): string {
  switch (message) {
    case "PENDING":
      return "Pembelian Masih Pending";
    case "FAILED":
      return `Transaksi Gagal${ket ? `, ${ket}` : ", Saldo telah otomatis dikembalikan ke akun"}`;
    case "PAID":
      return "Transaksi Telah Dibayar";
    case "SUCCESS":
      return `Transaksi Berhasil${ket ? ` - ${ket}` : ""}`;
    default:
      return "Status tidak dikenali";
  }
}