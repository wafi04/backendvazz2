import { Prisma } from "@prisma/client";
import { formatRupiah } from "./format";

export async function ValidationMethodPayment({
  paymentCode,
  amount,
  tx,
}: {
  amount: number;
  paymentCode: string;
  tx: Prisma.TransactionClient;
}) {
  try {
    const method = await tx.paymentMethod.findFirst({
      where: {
        code: paymentCode,
        isActive: "active",
      },
    });

    let message: string = "";
    let status: boolean = true;

    if (!method) {
      return {
        valid: false,
        message: "Metode Pembayaran tidak tersedia",
        method: null,
        taxAmount: 0,
        totalAmount: amount,
        expireMinutes: 0,
      };
    }

    // Validasi min/max
    if (method.minAmount && amount < method.minAmount) {
      status = false;
      message = `Harga kurang dari ${formatRupiah(method.minAmount)}`;
    }

    if (method.maxAmount && amount > method.maxAmount) {
      status = false;
      message = `Batas Harga telah limit ${formatRupiah(method.maxAmount)}`;
    }

    // Jika tidak valid, return early
    if (!status) {
      return {
        valid: false,
        message,
        method,
        taxAmount: 0,
        totalAmount: amount,
        expireMinutes: method.minExpired || 0,
      };
    }

    // Hitung pajak
    let taxAmount = 0;
    if (method.code === "NQ") {
      taxAmount = Math.round(amount * 0.007); // 0.7% = 0.007
    } else if (method.taxAdmin) {
    }

    const totalAmount = Math.round(amount + taxAmount);

    return {
      valid: true,
      message: "Validasi berhasil",
      method,
      taxAmount,
      totalAmount,
      expireMinutes: method.minExpired || 0,
    };
  } catch (error) {
    console.error("Error in ValidationMethodPayment:", error);
    return {
      valid: false,
      message: "Terjadi kesalahan sistem",
      method: null,
      taxAmount: 0,
      totalAmount: amount,
      expireMinutes: 0,
    };
  }
}