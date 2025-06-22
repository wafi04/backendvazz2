export type ServiceData = {
    id: number;
    categoryId: number;
    subCategoryId: number;
    providerId: string;
    serviceName: string;
    price: number;
    priceFromDigi: number;
    priceReseller: number;
    pricePlatinum: number;
    priceFlashSale: number | null;
    priceSuggest: number;
    profit: number;
    profitReseller: number;
    profitPlatinum: number;
    profitSuggest: number;
  
    isProfitFixed: string;
    isFlashSale: string;
    isSuggest: string;
    titleFlashSale: string | null;
    bannerFlashSale: string | null;
    expiredFlashSale: string | null;
    note: string;
    status: string;
    provider: string;
    productLogo: string | null;
  
    createdAt: string | Date | null;
    updatedAt: string | Date | null;
  };