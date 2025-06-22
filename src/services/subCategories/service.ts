import { CacheService } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { FormValuesSubCategory } from "../../validation/category";

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