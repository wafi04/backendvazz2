import { Prisma } from "@prisma/client";
import { CacheService } from "../../lib/cache";
import { prisma } from "../../lib/prisma";
import { ServiceFormData } from "../../validation/service";

interface SearchParams {
    query?: string;
    category?: number
    subCategory?: number;
    minPrice?: number;
    maxPrice?: number;
    status?: 'active' | 'inactive';
}

export class ProductService {
    private cachePrefix = "products:";
    private allProducts = "products:all";
    private cacheExpiration = 3600;
    
    async getProductById(id: number) {
        const cacheKey = `${this.cachePrefix}${id}`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const service = await prisma.service.findUnique({
            where: { id },
        });
        if (service) {
            await CacheService.set(cacheKey, service, this.cacheExpiration);
        }
        return service;
    }
    
    async getProductByCode(code: string) {
        const cacheKey = `${this.cachePrefix}code:${code}`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const service = await prisma.service.findFirst({
            where: { providerId: code },
        });
        if (service) {
            await CacheService.set(cacheKey, service, this.cacheExpiration);
        }
        return service;
    }
    
    async getProducts() : Promise<ServiceFormData[]> {
        const cached = await CacheService.get(this.allProducts) as ServiceFormData[];
        if (cached) {
            return cached;
        }
        const products = await prisma.service.findMany({
            orderBy: { createdAt: 'desc' }
        }) as ServiceFormData[];
        await CacheService.set(
            this.allProducts,
            products,
            this.cacheExpiration
        );
        return products;
    }


async getServiceByCategory(categoryId: string, subCategoryId?: string, role?: string) {
    const cacheKey = `${this.cachePrefix}category:${categoryId}${subCategoryId ? `:sub:${subCategoryId}` : ''}${role ? `:role:${role}` : ''}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) {
        return cached;
    }

    const where: Prisma.ServiceWhereInput = { 
        categoryId: Number(categoryId),
        status: 'active'
    };
    
    if (subCategoryId) {
        where.subCategoryId = Number(subCategoryId);
    }

    const services = await prisma.service.findMany({
        where,
        select: {
            priceFlashSale: true,
            expiredFlashSale: true,
            isFlashSale: true,
            isSuggest: true,
            price: true,
            priceSuggest: true,
            pricePlatinum: true,
            priceReseller: true,
            serviceName: true,
            productLogo: true,
            note: true,
            providerId : true
        },
        orderBy: { price: 'asc' }
    });

    // Separate flash sale and regular services
    const flashSaleServices = [] as any[];
    const regularServices = [] as any[]

    const transformedServices = services.map(service => {
        let currentPrice = service.price;
        const now = new Date();
        const isFlashSaleActive = service.isFlashSale === 'active' && 
                                 service.priceFlashSale && 
                                 service.expiredFlashSale && 
                                 now <= new Date(service.expiredFlashSale);
        
        // Determine price based on role (suggest tidak mengubah price)
        switch (role?.toLowerCase()) {
            case 'reseller':
                currentPrice = service.priceReseller;
                break;
            case 'platinum':
                currentPrice = service.pricePlatinum;
                break;
            default:
                if (isFlashSaleActive) {
                    currentPrice = service.priceFlashSale  ?? 0
                }
                break;
        }

        const transformedService = {
            ...service,
            currentPrice,
            originalPrice: service.price,
            priceInfo: {
                role: role || 'default',
                isFlashSale: isFlashSaleActive,
                flashSaleExpired: service.expiredFlashSale
            },
            suggestInfo: null as { suggestPrice: number;   } | null
        };


        if (service.isSuggest === 'true') {
            transformedService.suggestInfo = {
                suggestPrice: service.priceSuggest,
            };
        }

        return transformedService;
    });

    // Separate services by flash sale status
    transformedServices.forEach(service => {
        if (service.priceInfo.isFlashSale) {
            flashSaleServices.push(service);
        } else {
            regularServices.push(service);
        }
    });

    const result = {
        flashSaleServices,
        regularServices,
        totalServices: transformedServices.length,
        hasFlashSale: flashSaleServices.length > 0,
        role: role || 'default'
    };

    await CacheService.set(cacheKey, result, this.cacheExpiration);
    return result;
}
    async createProduct(data: ServiceFormData) {
        // Ensure required fields are present
        const { priceFromDigi, profitSuggest, ...rest } = data as any;
        const newProduct = await prisma.service.create({
            data: {
                ...rest,
                priceFromDigi: priceFromDigi ?? 0, 
                profitSuggest: profitSuggest ?? 0, 
            },
        });
        
        // Update cache
        const cacheKey = `${this.cachePrefix}${newProduct.id}`;
        await CacheService.set(cacheKey, newProduct, this.cacheExpiration);
        
        // Clear all products cache
        await CacheService.del(this.allProducts);
        
        return newProduct;
    }

    async updateProduct(id: number, data: ServiceFormData) {
        const cacheKey = `${this.cachePrefix}${id}`;
        const updatedProduct = await prisma.service.update({
            where: { id },
            data,
        });
        
        // Update individual cache
        await CacheService.set(cacheKey, updatedProduct, this.cacheExpiration);
        
        // Clear related caches
        await CacheService.del(this.allProducts);
        
        // If providerId changed, clear old code cache
        if (data.providerId) {
            const oldCodeCacheKey = `${this.cachePrefix}code:${data.providerId}`;
            await CacheService.del(oldCodeCacheKey);
        }
        
        return updatedProduct;
    }

    async deleteProduct(id: number) {
        // Get product first to clear code cache
        const product = await prisma.service.findUnique({
            where: { id },
        });
        if (!product) {
            throw new Error("Product not found");
        }        
        await prisma.service.delete({
            where: { id },
        });
        
        // Clear caches
        const cacheKey = `${this.cachePrefix}${id}`;
        await CacheService.del(cacheKey);
        await CacheService.del(this.allProducts);
        
        // Clear code cache if product existed
        if (product?.providerId) {
            const codeCacheKey = `${this.cachePrefix}code:${product.providerId}`;
            await CacheService.del(codeCacheKey);
        }
        
        return { message: "Product deleted successfully" };
    }

    async searchProducts(params: SearchParams) {
        const { query, category, minPrice, maxPrice, status = 'active' } = params;
        
        const where: Prisma.ServiceWhereInput = {};
        
        // Status filter
        if (status) {
            where.status = status;
        }
        
        // Text search
        if (query) {
            where.OR = [
                { serviceName: { contains: query, mode: 'insensitive' } },
                { providerId: { contains: query, mode: 'insensitive' } }
            ];
        }
        
        // Category filter
        if (category) {
            where.categoryId = category;
        }
        
        // Price range filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {};
            if (minPrice !== undefined) {
                where.price.gte = minPrice;
            }
            if (maxPrice !== undefined) {
                where.price.lte = maxPrice;
            }
        }
        
        const products = await prisma.service.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
        
        return products;
    }

    async getProductsByCategory(category: number) {
        const cacheKey = `${this.cachePrefix}category:${category}`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        const products = await prisma.service.findMany({
            where: { categoryId : category },
            orderBy: { serviceName: 'asc' }
        });
        
        await CacheService.set(cacheKey, products, this.cacheExpiration);
        return products;
    }

    async getActiveProducts() {
        const cacheKey = `${this.cachePrefix}active`;
        const cached = await CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        
        const products = await prisma.service.findMany({
            where: { status: 'active' },
            orderBy: { serviceName: 'asc' }
        });
        
        await CacheService.set(cacheKey, products, this.cacheExpiration);
        return products;
    }

    // Clear all product-related cache
    async clearCache() {
        const keys = await CacheService.keys(`${this.cachePrefix}*`);
        if (keys.length > 0) {
            await Promise.all(keys.map(key => CacheService.del(key)));
        }
    }
}