import { Context } from "hono";
import { Digiflazz } from "../../lib/digiflazz";
import { prisma } from "../../lib/prisma";

export async function GetServices(c: Context) {
  const username = process.env.DIGI_USERNAME!;
  const apiKey = process.env.DIGI_API_KEY!;

  if (!username || !apiKey) {
    return c.json({ message: "DIGI_USERNAME and DIGI_API_KEY must be set in environment variables" }, 500);
  }

  const digiflazz = new Digiflazz(username, apiKey);
  let rawResponse;

  try {
    rawResponse = await digiflazz.checkPrice();
    if (typeof rawResponse === "string") rawResponse = JSON.parse(rawResponse);
  } catch (e) {
    return c.json({ message: "Failed to fetch or parse Digiflazz response" }, 500);
  }

  const dataArray: any[] =
    Array.isArray(rawResponse) ? rawResponse :
    rawResponse?.data && Array.isArray(rawResponse.data) ? rawResponse.data :
    rawResponse?.response?.data && Array.isArray(rawResponse.response.data) ? rawResponse.response.data :
    [];

  if (dataArray.length === 0) {
    return c.json({ message: "No valid data from Digiflazz" }, 500);
  }

  const categories = await prisma.category.findMany();
  if (!categories.length) {
    return c.json({ message: "No categories found", stats: { processed: 0, created: 0, updated: 0 } });
  }

  const BATCH_SIZE = 50;
  const stats = { processed: 0, created: 0, updated: 0 };
  const categoryMatches: Record<string, number> = {};

  for (const category of categories) {
    if (!category.brand) continue;

    const matchingItems = dataArray.filter(
      (item) => item?.brand?.toUpperCase() === category.brand.toUpperCase()
    );

    categoryMatches[category.brand] = matchingItems.length;

    for (let i = 0; i < matchingItems.length; i += BATCH_SIZE) {
      const batch = matchingItems.slice(i, i + BATCH_SIZE);

      try {
        await prisma.$transaction(async (tx) => {
          for (const item of batch) {
            stats.processed++;

            const existing = await tx.service.findFirst({
              where: { providerId: item.buyer_sku_code },
            });

              const match = item.buyer_sku_code.match(/^([A-Z]+)/);
                const matchedProvider = match ? match[1] : item.buyer_sku_code;

                const subCategory = await tx.subCategory.findFirst({
                where: {
                    code: matchedProvider,
                    categoryId: category.id,
                },
              });
            const isFixed = item.category === "Voucher" || item.category === "PLN";
            const priceModal = item.price;
            const defaultProfit = {
              profit: 4,
              profitReseller: 3,
              profitPlatinum: 2,
              isProfitFixed: isFixed ? "active" : "inactive",
            };

            const calculatePrice = (profit: number, fixed: boolean) =>
              fixed ? priceModal + profit : Math.round(priceModal + (priceModal * profit) / 100);

            if (existing) {
              const regular = calculatePrice(existing.profit, existing.isProfitFixed === "active");
              const reseller = calculatePrice(existing.profitReseller, existing.isProfitFixed === "active");
              const platinum = calculatePrice(existing.profitPlatinum, existing.isProfitFixed === "active");

              await tx.service.update({
                where: { id: existing.id },
                data: {
                  subCategoryId : subCategory?.id,
                  price: regular,
                  priceFromDigi: priceModal,
                  priceReseller: reseller,
                  pricePlatinum: platinum,
                  status: item.seller_product_status ? "active" : "inactive",
                },
              });

              stats.updated++;
            } else {
              const regular = calculatePrice(defaultProfit.profit, defaultProfit.isProfitFixed === "active");
              const reseller = calculatePrice(defaultProfit.profitReseller, defaultProfit.isProfitFixed === "active");
              const platinum = calculatePrice(defaultProfit.profitPlatinum, defaultProfit.isProfitFixed === "active");

              await tx.service.create({
                data: {
                 serviceName: item.product_name,
                  subCategoryId: subCategory?.id,
                  categoryId: category.id,
                  providerId: item.buyer_sku_code,
                  price: regular,
                  priceFromDigi: priceModal,
                  priceReseller: reseller,
                  pricePlatinum: platinum,
                  priceSuggest: 0,
                  profit: defaultProfit.profit,
                  profitReseller: defaultProfit.profitReseller,
                  profitPlatinum: defaultProfit.profitPlatinum,
                  isProfitFixed: defaultProfit.isProfitFixed,
                  profitSuggest: 0,
                  isSuggest: "inactive",
                  note: item.desc || "",
                  status: item.seller_product_status ? "active" : "inactive",
                  provider: "digiflazz",
                  productLogo: null,
                  isFlashSale: "inactive",
                },
              });

              stats.created++;
            }
          }
        }, { timeout: 30000, maxWait: 5000 });
      } catch (e) {
        console.error(`Error in batch for ${category.brand}:`, e);
      }
    }
  }

  return c.json({
    message: "Sync completed",
    stats,
    categoryMatches,
  });
}
