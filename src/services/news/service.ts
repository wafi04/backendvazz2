import { CacheService } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { newsCreateSchema, newsUpdateSchema } from "../../validation/news";

export class News {
  private cachePrefix = "news:";
  private allNews = "news:all";
  private cacheExpiration = 3600;

  async getAllNewsById(id: number) {
    const cacheKey = `${this.cachePrefix}${id}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const news = await prisma.news.findUnique({
      where: { id },
    });
    if (news) {
      await CacheService.set(cacheKey, news, this.cacheExpiration);
    }
    return news;
  }

  async getNews() {
    const cached = await CacheService.get(this.allNews);
    if (cached) {
      return cached;
    }
    const news = await prisma.news.findMany();
    await CacheService.set(this.allNews, news, this.cacheExpiration);
    return news;
  }

  async create(data: newsCreateSchema) {
    const news = await prisma.news.create({
      data: {
        ...data,
      },
    });

    await CacheService.set(
      `${this.cachePrefix}${news.id}`,
      news,
      this.cacheExpiration
    );
    await CacheService.del(this.allNews);
  }
  async update(id: number, data: newsUpdateSchema) {
    const news = await prisma.news.update({
      where: { id },
      data: { ...data },
    });
    await CacheService.set(
      `${this.cachePrefix}${id}`,
      news,
      this.cacheExpiration
    );
    await CacheService.del(this.allNews);
    return news;
  }

  async delete(id: number) {
    const methods = await prisma.news.delete({
      where: { id },
    });
    await CacheService.del([`${this.cachePrefix}${id}`, this.allNews]);
    return methods;
  }
}
