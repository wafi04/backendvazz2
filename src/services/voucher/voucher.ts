import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { CacheService } from "../../lib/cache";
import {
  VoucherValidation,
  ValidateVoucherInput,
} from "../../validation/voucher";
import { PaginationUtil } from "../../utils/pagination";

export class Voucher {
  private cachePrefix = "vouchers:";
  private allVouchersKey = "vouchers:all";
  private cacheExpiration = 3600;
  
  constructor() {}

  // Helper method to generate cache keys
  private getCacheKey(id: number | string, suffix?: string): string {
    return `${this.cachePrefix}${id}${suffix ? `:${suffix}` : ''}`;
  }

  // Helper method to invalidate related caches
  private async invalidateVoucherCaches(id?: number): Promise<void> {
    const keysToDelete: string[] = [this.allVouchersKey];
    
    if (id) {
      keysToDelete.push(
        this.getCacheKey(id),
        this.getCacheKey(id, 'with_usages')
      );
    }

    // Also clear any filtered cache results
    const filterKeys = await CacheService.keys(`${this.cachePrefix}filters:*`);
    keysToDelete.push(...filterKeys);

    await CacheService.del(keysToDelete);
  }

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

    // Invalidate caches
    await this.invalidateVoucherCaches();

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

    // Invalidate caches
    await this.invalidateVoucherCaches(id);

    return req;
  }

  async findById(id: number) {
    const cacheKey = this.getCacheKey(id);
    
    // Try to get from cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

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

    // Cache the result if found
    if (voucher) {
      await CacheService.set(cacheKey, voucher, this.cacheExpiration);
    }

    return voucher;
  }

  async findByCode(code: string) {
    const cacheKey = this.getCacheKey(`code:${code}`);
    
    // Try to get from cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

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

    // Cache the result if found
    if (voucher) {
      await CacheService.set(cacheKey, voucher, this.cacheExpiration);
    }

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

    // Create cache key based on filters
    const filterString = JSON.stringify({
      isActive,
      discountType,
      search,
      page,
      limit,
    });
    const cacheKey = `${this.cachePrefix}filters:${Buffer.from(filterString).toString('base64')}`;

     const { skip, take, currentPage, itemsPerPage } = PaginationUtil.calculatePagination(
            page.toString(), 
            limit.toString()
      )
      

    // Try to get from cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

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

     const result = PaginationUtil.createPaginatedResponse(
        vouchers,
        currentPage,
        itemsPerPage,
        total
      )

    // Cache the result
    await CacheService.set(cacheKey, result, this.cacheExpiration);

    return result;
  }

  async validateVoucher(input: ValidateVoucherInput) {
    const { code, amount, categoryId } = input;

    // Find voucher by code (this will use cache)
    const voucher = await this.findByCode(code) as Prisma.VoucherGetPayload<{
      include: { categories: { include: { category: true } } }
    }>;

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

    // Invalidate caches since usage count changed
    await this.invalidateVoucherCaches(voucherId);

    return usage;
  }

  async delete(id: number) {
    const req = await prisma.voucher.delete({
      where: { id },
    });

    // Invalidate caches
    await this.invalidateVoucherCaches(id);

    return req;
  }

  // Additional method to manually clear all voucher caches
  async clearAllCaches(): Promise<void> {
    const keys = await CacheService.keys(`${this.cachePrefix}*`);
    if (keys.length > 0) {
      await CacheService.del(keys);
    }
  }
}