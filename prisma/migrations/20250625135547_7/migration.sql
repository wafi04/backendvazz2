-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_sub_category_id_fkey";

-- AlterTable
ALTER TABLE "services" ALTER COLUMN "sub_category_id" DROP NOT NULL,
ALTER COLUMN "sub_category_id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
