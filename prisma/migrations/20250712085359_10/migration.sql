-- AlterTable
ALTER TABLE "manual_transaction" ADD COLUMN     "price_duitku" INTEGER,
ADD COLUMN     "price_purchase" INTEGER;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "price_duitku" INTEGER;
