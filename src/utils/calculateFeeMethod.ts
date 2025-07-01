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
  const method = await tx.paymentMethod.findFirst({
    where: {
      code: paymentCode,
      isActive: "active",
    },
  });

  let message: string = "";
  let status: boolean = true;

  if (!method) {
    status = false;
    message = "Metode Pembayaran tidak tersedia";
    return {
      valid: false,
      message,
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
  if (method.taxType && method.taxAdmin) {
    if (method.taxType === "PERCENTAGE") {
      taxAmount = Math.max((amount * method.taxAdmin) / 100)
    } else if (method.taxType === "FIXED") {
      taxAmount = method.taxAdmin;
    }
  } else {
    console.log("No tax applied (typeTax or taxAdmin is null)");
  }

  const totalAmount = Math.round(amount + taxAmount);

  return {
    valid: true,
    method,
    taxAmount: taxAmount,
    totalAmount,
    methodTax: method.taxAdmin,
  };
}