import { Prisma } from "@prisma/client";
import { Digiflazz } from "../../lib/digiflazz";
import { DIGI_KEY, DIGI_USERNAME, TRANSACTION_FLOW } from "../../constants";

export async function PaymentUsingSaldo({
  amount,
  noWa,
  username,
  productCode,
  productName,
  userId,
  serverId,
  tx,
  orderId,
}: {
  username: string;
  amount: number;
  noWa: string;
  productName: string;
  productCode: string;
  userId: string;
  serverId?: string;
  orderId: string;
  tx: Prisma.TransactionClient;
}) {
  const digi = new Digiflazz(DIGI_USERNAME, DIGI_KEY);

  // Create payment record
  const pembayaran = await tx.payment.create({
    data: {
      price: amount.toString(),
      method: "SALDO",
      totalAmount: amount,
      buyerNumber: noWa,
      status: "PENDING",
      orderId,
      createdAt: new Date(),
    },
  });

  // Process payment through Digiflazz
  const ToDigi = await digi.TopUp({
    productCode,
    userId,
    serverId,
    reference: orderId,
  });

  const digiData = ToDigi?.data;

  if (!digiData) {
    return {
      status: false,
      code: 400,
      message: "Failed to process payment. No response from payment gateway.",
      data: {
        pembayaran,
        orderId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const status: string =
    digiData.status === "Pending"
      ? TRANSACTION_FLOW.PROCESS
      : digiData.status === "Sukses"
      ? TRANSACTION_FLOW.SUCCESS
      : TRANSACTION_FLOW.FAILED;

  if (status !== TRANSACTION_FLOW.FAILED) {
    const updatedUser = await tx.user.update({
      where: {
        username,
      },
      data: {
        balance: { decrement: amount },
      },
      select: {
        id: true,
        username: true,
        balance: true,
      },
    });

    return {
      status: true,
      code: 201,
      message: digiData.message || "Payment processed successfully",
      data: {
        pembayaran,
        transaction: {
          orderId,
          productName,
          amount,
          digiflazzRef: digiData.ref_id || null,
          serial: digiData.sn || null,
          status,
        },
        user: {
          username,
          newBalance: updatedUser.balance,
        },
        timestamp: new Date().toISOString(),
      },
    };
  } else {
    return {
      status: false,
      code: 400,
      message: digiData.message || "Transaction failed",
      data: {
        pembayaran,
        error: digiData.rc || "UNKNOWN_ERROR",
        errorMessage: digiData.message || null,
        orderId,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
