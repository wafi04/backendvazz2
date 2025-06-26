import { CacheService } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { MethodSchemas } from "../../validation/paymentMethod";

export class PaymentMethodService {
  private cachePrefix = "methods:";
  private allMethods = "methods:all";
  private cacheExpiration = 3600;
  
  async getPaymentMethodById(id: number) {
    const cacheKey = `${this.cachePrefix}${id}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id },
    });
    if (paymentMethod) {
      await CacheService.set(cacheKey, paymentMethod, this.cacheExpiration);
    }
    return paymentMethod;
  }

  async getPaymentMethodByCode(code: string) {
    const cacheKey = `${this.cachePrefix}${code}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { code },
    });     
    if (paymentMethod) {
      await CacheService.set(cacheKey, paymentMethod, this.cacheExpiration);
    }
    return paymentMethod;
  }

  async getPaymentMethods(status : string) {
    const cached = await CacheService.get(this.allMethods);
    if (cached) {
      return cached;
    }
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
      isActive : status
    }
    });
    await CacheService.set(
      this.allMethods,
      paymentMethods,
      this.cacheExpiration
    );
    return paymentMethods;
  }

  // Example method to add a new payment method
  async addPaymentMethod(paymentMethod: MethodSchemas) {
    const existing = await prisma.paymentMethod.findFirst({
      where: { code: paymentMethod.code },
    });

    if (existing) {
      throw new Error("Payment method with this code already exists");
    }
    const payment = await prisma.paymentMethod.create({
      data: {
        ...paymentMethod,
      },
    });
    await CacheService.set(
      `${this.cachePrefix}${payment.id}`,
      payment,
      this.cacheExpiration
    );
    await CacheService.del(this.allMethods);
    return paymentMethod;
  }

   async updateSubCategory(id: number, data: MethodSchemas) {
      const methods = await prisma.paymentMethod.update({
        where: { id },
        data: { ...data },
      });
      await CacheService.set(`${this.cachePrefix}${id}`, methods, this.cacheExpiration);
      await CacheService.del(this.allMethods);
      return methods;
  
    }

  // Example method to delete a payment method
  async deletePaymentMethod(id: number) {
    const methods = await prisma.paymentMethod.delete({
      where: { id },
    });
    await CacheService.del([`${this.cachePrefix}${id}`, this.allMethods]);
    return methods;
  }
}
