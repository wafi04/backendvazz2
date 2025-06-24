import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  VoucherValidation,
  ValidateVoucherInput,
} from "../../validation/voucher";

export class Voucher {
  private cachePrefix = "vouchers:";
  private allVouchersKey = "vouchers:all";
  private cacheExpiration = 3600;
  constructor() {}

  async create(data: VoucherValidation) {
    const { categoryIds, ...voucherData } = data;

    const req = await prisma.voucher.create({
      data: {
        ...voucherData,
        // Jika ada categories, buat relasi
        ...(categoryIds &&
          categoryIds.length > 0 && {
            categories: {
              create: categoryIds.map((categoryId) => ({
                categoryId: categoryId,
              })),
            },
          }),
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return req;
  }

  async update(id: number, data: Partial<VoucherValidation>) {
    const { categoryIds, ...voucherData } = data;

    const req = await prisma.voucher.update({
      where: { id },
      data: {
        ...voucherData,
        // Handle category updates if provided
        ...(categoryIds !== undefined && {
          categories: {
            deleteMany: {}, // Delete existing relations
            create: categoryIds.map((categoryId) => ({
              categoryId: categoryId,
            })),
          },
        }),
      },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return req;
  }

  async findById(id: number) {
    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
        usages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10, // Latest 10 usages
        },
      },
    });

    return voucher;
  }

  async findByCode(code: string) {
    const voucher = await prisma.voucher.findUnique({
      where: { code },
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
    });

    return voucher;
  }

  async findAll(filters?: {
    isActive?: string;
    discountType?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      isActive,
      discountType,
      search,
      page = 1,
      limit = 10,
    } = filters || {};

    const where: Prisma.VoucherWhereInput = {};

    if (isActive) {
      where.isActive = isActive;
    }

    if (discountType) {
      where.discountType = discountType;
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        include: {
          categories: {
            include: {
              category: true,
            },
          },
          _count: {
            select: {
              usages: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.voucher.count({ where }),
    ]);

    return {
      data: vouchers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async validateVoucher(input: ValidateVoucherInput) {
    const { code, amount, categoryId } = input;

    // Find voucher by code
    const voucher = await this.findByCode(code);

    if (!voucher) {
      throw new Error("Voucher not found");
    }

    // Check if voucher is active
    if (voucher.isActive !== "active") {
      throw new Error("Voucher is not active");
    }

    // Check date validity
    const now = new Date();
    if (now < voucher.startDate) {
      throw new Error("Voucher is not yet active");
    }

    if (now > voucher.expiryDate) {
      throw new Error("Voucher has expired");
    }

    // Check minimum purchase
    if (voucher.minPurchase && amount < voucher.minPurchase) {
      throw new Error(`Minimum purchase amount is ${voucher.minPurchase}`);
    }

    // Check usage limit
    if (voucher.usageLimit && voucher.usageCount >= voucher.usageLimit) {
      throw new Error("Voucher usage limit exceeded");
    }

    // Check category restriction
    if (voucher.isForAllCategories !== "true" && categoryId) {
      const isValidCategory = voucher.categories.some(
        (vc) => vc.categoryId === categoryId
      );
      if (!isValidCategory) {
        throw new Error("Voucher is not applicable for this category");
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (voucher.discountType === "PERCENTAGE") {
      discountAmount = (amount * voucher.discountValue) / 100;
      if (voucher.maxDiscount && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount;
      }
    } else if (voucher.discountType === "FIXED") {
      discountAmount = voucher.discountValue;
    }

    return {
      voucher,
      discountAmount,
      finalAmount: amount - discountAmount,
    };
  }

  async useVoucher(
    voucherId: number,
    orderId: string,
    amount: number,
    username?: string,
    whatsapp?: string
  ) {
    // Create voucher usage record
    const usage = await prisma.voucherUsage.create({
      data: {
        voucherId,
        orderId,
        amount,
        username,
        whatsapp,
      },
    });

    // Increment usage count
    await prisma.voucher.update({
      where: { id: voucherId },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    return usage;
  }

  async delete(id: number) {
    const req = await prisma.voucher.delete({
      where: { id },
    });

    return req;
  }
}
