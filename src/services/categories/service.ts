import { prisma } from "../../lib/prisma";
import { CacheService } from "../../lib/cache";
import { FormValuesCategory } from "../../validation/category";

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