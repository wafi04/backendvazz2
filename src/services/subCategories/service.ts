import { Prisma } from "@prisma/client";
import { CacheService } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { FilterSubCategories } from "../../types/subCategory";
import { FormValuesSubCategory } from "../../validation/category";
import { PaginatedResponse, PaginationUtil } from "../../utils/pagination";

export class SubCategoryService {
  private cachePrefix = "subCategories:";
  private allCategoriesKey = "subCategories:all";
  private cacheExpiration = 3600;
  async getAllSubCategories() {
      const cached = await CacheService.get(this.allCategoriesKey);
    if (cached) {
      return cached;
    }
    const subCategories =     await prisma.subCategory.findMany();
    await CacheService.set(this.allCategoriesKey, subCategories, this.cacheExpiration);
    return subCategories;
}

  async getSubCategoryById(id: number) {
     const cacheKey = `${this.cachePrefix}${id}`;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }
    const subCategory = await prisma.subCategory.findUnique({
      where: { id },
    });
     if (subCategory) {
      await CacheService.set(cacheKey, subCategory, this.cacheExpiration);
    }

    return subCategory;
  }
  async getSubCategoriesWithPagination(data: FilterSubCategories): Promise<PaginatedResponse<any>> {
      // Setup pagination
      const { skip, take, currentPage, itemsPerPage } = PaginationUtil.calculatePagination(
        data.page, 
        data.limit
      )
  
      // Setup filter
      const filter: Prisma.SubCategoryWhereInput = {}
      
      if (data.status) {
        filter.isActive = data.status
      }
      
      if (data.search) {
        filter.OR = [
          { name: { contains: data.search, mode: 'insensitive' } },
          { code: { contains: data.search, mode: 'insensitive' } }
        ]
      }
  
      // Execute queries
      const [categories, totalItems] = await Promise.all([
        prisma.subCategory.findMany({
          where: filter,
          skip,
          take,
        }),
        prisma.subCategory.count({ where: filter })
      ])
  
      return PaginationUtil.createPaginatedResponse(
        categories,
        currentPage,
        itemsPerPage,
        totalItems
      )
    }
  

  async createSubCategory(data : FormValuesSubCategory) {
    const subCategory = await prisma.subCategory.create({
      data: { 
        ...data,
       },
    });
    await CacheService.set(`${this.cachePrefix}${subCategory.id}`, subCategory, this.cacheExpiration);
    await CacheService.del(this.allCategoriesKey);
    return subCategory;
  
}

  async updateSubCategory(id: number, data: FormValuesSubCategory) {
    const subCategory = await prisma.subCategory.update({
      where: { id },
      data: { ...data },
    });
    await CacheService.set(`${this.cachePrefix}${id}`, subCategory, this.cacheExpiration);
    await CacheService.del(this.allCategoriesKey);
    return subCategory;

  }

  async deleteSubCategory(id: number) {
    const subCategory = await prisma.subCategory.delete({
      where: { id },
    });
    await CacheService.del([`${this.cachePrefix}${id}`, this.allCategoriesKey]);
    return subCategory;
  }
}