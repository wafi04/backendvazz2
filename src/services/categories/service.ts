import { prisma } from "../../lib/prisma";
import { CacheService } from "../../lib/cache";
import { FormValuesCategory } from "../../validation/category";
import { Prisma } from "@prisma/client";
import { FilterCategories, PaginatedResponse, PaginationUtil } from "../../utils/pagination";

export class CategoryService {
  private cachePrefix = "category:";
  private allCategoriesKey = "categories:all";
  private cacheExpiration = 3600;

  async getAllCategories() {
    // Try cache first
    const cached = await CacheService.get(this.allCategoriesKey);
    if (cached) {
      return cached;
    }

    // Fallback to database
    const categories = await prisma.category.findMany();
    await CacheService.set(this.allCategoriesKey, categories, this.cacheExpiration);
    
    return categories;
  }


  async getCategoriesWithPagination(data: FilterCategories): Promise<PaginatedResponse<any>> {
    // Setup pagination
    const { skip, take, currentPage, itemsPerPage } = PaginationUtil.calculatePagination(
      data.page, 
      data.limit
    )

    // Setup filter
    const filter: Prisma.CategoryWhereInput = {}
    
    if (data.status) {
      filter.status = data.status
    }
    
    if (data.search) {
      filter.OR = [
        { name: { contains: data.search, mode: 'insensitive' } },
        { code: { contains: data.search, mode: 'insensitive' } },
        { type: { contains: data.search, mode: 'insensitive' } },
      ]
    }

    // Execute queries
    const [categories, totalItems] = await Promise.all([
      prisma.category.findMany({
        where: filter,
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.category.count({ where: filter })
    ])

    return PaginationUtil.createPaginatedResponse(
      categories,
      currentPage,
      itemsPerPage,
      totalItems
    )
  }


  async getCategoryById(id: number) {
    const cacheKey = `${this.cachePrefix}${id}`;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (category) {
      await CacheService.set(cacheKey, category, this.cacheExpiration);
    }

    return category;
  }

  async getAllCategoriesByType(type: string) {
      const cacheKey = `categories:all:${type}`;
      
      // Check Redis cache first
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const filter: Prisma.CategoryWhereInput = {
        status: 'active',
        type: type 
      }

      const categories = await prisma.category.findMany({
        where: filter,
        orderBy: { createdAt: 'desc' }
      });

      // Cache for 10 minutes
      await CacheService.set(cacheKey, categories, 600);
      
      return categories;
  }
  
    async getAllCategoriesByCode(code: string) {
      const cacheKey = `categories:all:${code}`;
      
      // Check Redis cache first
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const filter: Prisma.CategoryWhereInput = {
        status: 'active',
        code
      }

      const categories = await prisma.category.findFirst({
        where: filter,
        include: {
          subCategories : true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Cache for 10 minutes
      await CacheService.set(cacheKey, categories, 600);
      
      return categories;
}
  async createCategory(data: FormValuesCategory) {
    const category = await prisma.category.create({
      data: { ...data },
    });

    await CacheService.set(`${this.cachePrefix}${category.id}`, category, this.cacheExpiration);
    await CacheService.del(this.allCategoriesKey);

    return category;
  }

  async updateCategory(data: FormValuesCategory, id: number) {
    const category = await prisma.category.update({
      where: { id },
      data: { ...data },
    });

    // Update caches
    await CacheService.set(`${this.cachePrefix}${id}`, category, this.cacheExpiration);
    await CacheService.del(this.allCategoriesKey);

    return category;
  }

  async deleteCategory(id: number) {
    const category = await prisma.category.delete({
      where: { id },
    });

    // Remove from caches
    await CacheService.del([`${this.cachePrefix}${id}`, this.allCategoriesKey]);

    return category;
  }
}