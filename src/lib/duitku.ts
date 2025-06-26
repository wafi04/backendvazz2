import {
  DUITKU_EMAIL,
} from "../constants";
import axios from "axios";
import * as crypto from "crypto";

export type DuitkuCreateTransactionParams = {
  paymentAmount: number;
  merchantOrderId: string;
  productDetails: string;
  paymentCode: string;
  cust?: string;
  callbackUrl?: string;
  returnUrl?: string;
  noWa: string;
};

export type ResponseFromDuitkuCheckTransaction = {
  status: number;
  data: {
    merchantOrderId: string;
    reference: string;
    amount: string;
    fee: string;
    statusCode: string;
    statusMessage: string;
  };
};

export class Duitku {
  private DUITKU_KEY: string;
  private DUITKU_MERCHANT_CODE: string;
  private DUITKU_EXPIRY_PERIOD?: number;
  private BASE_URL =
    "https://passport.duitku.com/webapi/api/merchant/v2/inquiry";
  private SANDBOX_URL =
    "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry";

  private BASE_URL_GET_TRANSACTION =
    "https://passport.duitku.com/webapi/api/merchant/transactionStatus";

  private BASE_URL_GET_BALANCE =
    "https://passport.duitku.com/webapi/api/disbursement/checkbalance";

  constructor(
    duitkuKey: string,
    duitkuMerchantCode: string,
    duitkuExpiryPeriod?: number | undefined
  ) {
    this.DUITKU_KEY = duitkuKey;
    this.DUITKU_MERCHANT_CODE = duitkuMerchantCode;
    this.DUITKU_EXPIRY_PERIOD = duitkuExpiryPeriod;
  }

  async CreateTransaction({
    paymentAmount,
    callbackUrl,
    merchantOrderId,
    productDetails,
    paymentCode,
    cust,
    noWa,
    returnUrl,
  }: DuitkuCreateTransactionParams) {
    try {
      // Generate signature
      const signature = crypto
        .createHash("md5")
        .update(
          this.DUITKU_MERCHANT_CODE +
            merchantOrderId +
            paymentAmount +
            this.DUITKU_KEY
        )
        .digest("hex");

      const payload = {
        merchantCode: this.DUITKU_MERCHANT_CODE,
        paymentAmount: paymentAmount,
        merchantOrderId: merchantOrderId,
        productDetails: productDetails,
        paymentMethod: paymentCode,
        customerVaName: cust,
        phoneNumber: noWa,
        returnUrl,
        callbackUrl,
        signature: signature,
        expiryPeriod: this.DUITKU_EXPIRY_PERIOD,
      };

      // Make API request
      const response = await axios.post(this.BASE_URL, payload, {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      // Parse response
      const data = await response.data;
      return {
        status: data.statusMessage as string,
        code : data.statusCode as string,
        message: "Transaction created successfully",
        data: {
          ...data,
          merchantOrderId,
          signature,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create transaction",
        data: {
          merchantOrderId,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
  async GetTransaction({ merchantOrderId }: { merchantOrderId: string }) {
    // md5(merchantCode + merchantOrderId + apiKey).
    const sign = crypto
      .createHash("md5")
      .update(this.DUITKU_MERCHANT_CODE + merchantOrderId + this.DUITKU_KEY)
      .digest("hex");
    const payload = {
      merchantcode: this.DUITKU_MERCHANT_CODE,
      merchantOrderId,
      signature: sign,
    };
    const req = await axios.post<ResponseFromDuitkuCheckTransaction>(
      this.BASE_URL_GET_TRANSACTION,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return req.data;
  }

  async GetSaldo() {
    const sign = crypto
      .createHash("md5")
      .update((DUITKU_EMAIL as string) + new Date().getTime() + this.DUITKU_KEY)
      .digest("hex");

    const payload = {
      userId: 1,
      email: DUITKU_EMAIL,
      timestamp: new Date().getTime(),
      signature: sign,
    };

    const req = await axios.post(this.BASE_URL_GET_BALANCE, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return req.data;
  }
}
