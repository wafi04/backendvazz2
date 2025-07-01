import { DUITKU_API_KEY, DUITKU_MERCHANT_CODE } from "../../constants";
import { DuitkuService } from "../../lib/duitku";
import { prisma } from "../../lib/prisma";
import { GenerateRandomId } from "../../utils/generate";
import { getWIBTime } from "../../utils/time";
import { AuthService } from "../users/auth";

interface CreateDeposit {
    amount  : number,
    totalAmount : number,
    code : string,
    type: "DEPOSIT" | "MEMBERSHIP",
    username : string
}
export async function Deposit(data: CreateDeposit) {
    const userService = new AuthService()
    const {amount,code,totalAmount,type,username}   = data
    const user = await userService.getUserByUsername(username);
    if (!user) {
        throw new Error("User not found");
    }
 const methodResult = (await prisma.$queryRaw`
      SELECT name, code, tax_type AS "taxType", tax_admin AS "taxAdmin"
      FROM payment_methods 
      WHERE code = ${code} 
      LIMIT 1
    `) as Array<{
      name: string;
      code: string;
      taxType: string;
      taxAdmin: number;
    }>;

  
    


    if (methodResult.length === 0) {
      throw new Error("Payment method not found");
    }

    const method = methodResult[0];

    // Generate unique ID for merchant order
    const merchantOrderId = GenerateRandomId(
      type === "MEMBERSHIP" ? "MEM" : "DEP"
    );

    let fee = 0;
    let feeAmount = 0;

    if (method.taxType === "PERCENTAGE") {
      fee = (amount * method.taxAdmin) / 100;
      feeAmount = fee;
    } else if (method.taxType === "FIXED") {
      fee = method.taxAdmin;
      feeAmount = method.taxAdmin;
    } else if (method.code === "NQ") {
      fee = Math.ceil((amount * 0.7 ) / 100)
      feeAmount =  Math.ceil((amount * 0.7 ) / 100)
    }

    const duitku = new DuitkuService(
      DUITKU_API_KEY as string,
      DUITKU_MERCHANT_CODE as string
    );

    const paymentData = await duitku.CreateTransaction({
      paymentAmount: amount,
      paymentCode: code,
      merchantOrderId,
      productDetails:
        type === "MEMBERSHIP"
          ? `Membership ${user.username}`
          : `Deposit ${user.username}`,
      noWa: user.whatsapp as string,
      cust: user.username,
      returnUrl: `${process.env.NEXTAUTH_URL}/profile`,
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/v1/callback/duitku`,
    });

    if (paymentData.code !== "00") {
      throw new Error(
        `Failed to create payment: ${paymentData.data.statusMessage}`
      );
    }

    // Tentukan paymentNumber dari response Duitku
    const urlPaymentMethods = ["DA", "OV", "SA"];
    const vaPaymentMethods = ["I1", "BR", "B1", "BT", "SP", "FT", "M2", "VA"];
    let paymentNumber = "";

    if (urlPaymentMethods.includes(method.code)) {
      paymentNumber = paymentData.data.paymentUrl;
    } else if (vaPaymentMethods.includes(method.code)) {
      paymentNumber = paymentData.data.vaNumber || "";
    } else {
      paymentNumber = paymentData.data.qrString || "";
    }

    const currentTime = getWIBTime();
    const logData = JSON.stringify(paymentData.data);

    // Raw SQL Transaction - jauh lebih cepat
    const result = await prisma.$transaction(async (tx) => {
      if (type === "DEPOSIT") {
        await tx.$executeRaw`
          INSERT INTO deposits (
            username, method, status, amount,
            payment_reference, deposit_id, created_at, updated_at, log
          )
          VALUES (
            ${user.username}, ${method.name}, 'PENDING', ${amount}, 
            ${paymentNumber}, ${merchantOrderId}, 
            ${currentTime}, ${currentTime}, ${logData}
          )
        `;
      }

  // INSERT PAYMENT DULU - sebelum transaction
  await tx.$executeRaw`
    INSERT INTO payments (
      price, method, buyer_number, status, order_id, 
      payment_number, reference, fee_amount, total_amount, created_at, updated_at
    )
    VALUES (
      ${amount.toString()}, ${method.name}, ${user.whatsapp}, 'PENDING', 
      ${merchantOrderId}, ${paymentNumber}, 
      ${paymentData.data.reference || ""}, 
      ${feeAmount}, ${fee + amount},
      ${currentTime}, ${currentTime}
    )
  `;

  // BARU INSERT TRANSACTION - setelah payment ada
  const transactionResult = (await tx.$queryRaw`
    INSERT INTO transactions (
      profit, profit_amount, username, price, transaction_type, 
      service_name, order_id, status, is_digi, success_report_sent, log, message,
      created_at, updated_at
    )
    VALUES (
      ${amount}, ${amount}, ${user.username}, ${amount}, ${type}, 
      ${
        type === "MEMBERSHIP"
          ? `Membership ${user.username}`
          : `Deposit ${user.username}`
      }, 
      ${merchantOrderId}, 'PENDING', 'false', 'false', ${logData}, 'Transaction Pending',
      ${currentTime}, ${currentTime}
    )
    RETURNING *
  `) as Array<any>;

  return transactionResult[0];
    });
  
  return result

}