import { ServiceData } from "../types/service";

function hitungHarga(hargaDigi: number, profit: number, isFixed = true) {
  if (isFixed) {
    return hargaDigi + profit;
  } else {
    return hargaDigi + (hargaDigi * profit) / 100;
  }
}

function hitungProfitRupiah(hargaDigi: number, profit: number, isFixed = true) {
  if (isFixed) {
    return profit;
  } else {
    return Math.round((hargaDigi * profit) / 100);
  }
}

// Main function untuk calculate pricing
export function CalculatePricingWithProfitLogic(
  product: ServiceData,
  userRole?: string
) {
  const {
    priceFromDigi,
    profit,
    profitReseller,
    profitPlatinum,
    isProfitFixed,
    isFlashSale,
    priceFlashSale,
    expiredFlashSale,
  } = product;

  // Cek apakah flash sale masih aktif
  const isFlashSaleActive =
    isFlashSale &&
    priceFlashSale &&
    expiredFlashSale &&
    new Date() < new Date(expiredFlashSale);

  if (isFlashSaleActive) {
    const profitFlashSale = priceFlashSale! - priceFromDigi;
    return {
      price: priceFlashSale!,
      profit: profitFlashSale,
      profitRupiah: profitFlashSale,
      tier: "FLASH_SALE",
      isFlashSale: true,
      basePrice: priceFromDigi,
    };
  }

  // Tentukan tier berdasarkan role user
  let selectedProfit: number;
  let tier: string;

  switch (userRole?.toUpperCase()) {
    case "PLATINUM":
      selectedProfit = profitPlatinum;
      tier = "Platinum";
      break;
    case "RESELLER":
      selectedProfit = profitReseller;
      tier = "Reseller";
      break;
    case "MEMBER":
      selectedProfit = profit;
      tier = "Member";
      break;
    case "USER":
    default:
      selectedProfit = profit;
      tier = "REGULAR";
      break;
  }

  // Hitung harga dan profit
  const finalPrice = hitungHarga(
    priceFromDigi,
    selectedProfit,
    isProfitFixed === "active"
  );
  const profitRupiah = hitungProfitRupiah(
    priceFromDigi,
    selectedProfit,
    isProfitFixed === "active"
  );

  return {
    price: finalPrice,
    profit: selectedProfit,
    profitRupiah: profitRupiah,
    tier: tier,
    isFlashSale: false,
    basePrice: priceFromDigi,
    profitType: isProfitFixed ? "FIXED" : "PERCENTAGE",
  };
}

// Alternative function jika ingin lebih detail
export function CalculatePricingWithDetails(
  product: ServiceData,
  userRole?: string
) {
  const pricing = CalculatePricingWithProfitLogic(product, userRole);

  // Hitung semua tier untuk comparison
  const allTiers = {
    regular: {
      price: hitungHarga(
        product.priceFromDigi,
        product.profit,
        product.isProfitFixed === "active"
      ),
      profit: hitungProfitRupiah(
        product.priceFromDigi,
        product.profit,
        product.isProfitFixed === "active"
      ),
    },
    reseller: {
      price: hitungHarga(
        product.priceFromDigi,
        product.profitReseller,
        product.isProfitFixed === "active"
      ),
      profit: hitungProfitRupiah(
        product.priceFromDigi,
        product.profitReseller,
        product.isProfitFixed === "active"
      ),
    },
    platinum: {
      price: hitungHarga(
        product.priceFromDigi,
        product.profitPlatinum,
        product.isProfitFixed === "active"
      ),
      profit: hitungProfitRupiah(
        product.priceFromDigi,
        product.profitPlatinum,
        product.isProfitFixed === "active"
      ),
    },
  };

  let flashSaleInfo = null;
  if (
    product.isFlashSale &&
    product.priceFlashSale &&
    product.expiredFlashSale
  ) {
    const isActive = new Date() < new Date(product.expiredFlashSale);
    flashSaleInfo = {
      isActive,
      price: product.priceFlashSale,
      profit: product.priceFlashSale - product.priceFromDigi,
      expiredAt: product.expiredFlashSale,
    };
  }

  return {
    ...pricing,
    allTiers,
    flashSaleInfo,
    discount: {
      fromRegular: allTiers.regular.price - pricing.price,
      percentage:
        ((allTiers.regular.price - pricing.price) / allTiers.regular.price) *
        100,
    },
  };
}