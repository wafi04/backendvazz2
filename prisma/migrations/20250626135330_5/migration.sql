/*
  Warnings:

  - You are about to drop the `ManualTransaction` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ManualTransaction" DROP CONSTRAINT "ManualTransaction_order_id_fkey";

-- DropTable
DROP TABLE "ManualTransaction";

-- CreateTable
CREATE TABLE "manual_transaction" (
    "id" SERIAL NOT NULL,
    "order_id" VARCHAR(100),
    "manual_transaction_id" VARCHAR(100) NOT NULL,
    "user_id" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "price" INTEGER NOT NULL,
    "profit_amount" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,
    "zone" VARCHAR(50),
    "whatsapp" VARCHAR(20) NOT NULL,
    "product_name" VARCHAR(300) NOT NULL,
    "created_by" VARCHAR(100),
    "serial_number" TEXT,
    "reason" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manual_transaction_status_created_at_idx" ON "manual_transaction"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "manual_transaction_order_id_status_idx" ON "manual_transaction"("order_id", "status");

-- CreateIndex
CREATE INDEX "manual_transaction_user_id_status_idx" ON "manual_transaction"("user_id", "status");

-- CreateIndex
CREATE INDEX "manual_transaction_created_by_status_idx" ON "manual_transaction"("created_by", "status");

-- AddForeignKey
ALTER TABLE "manual_transaction" ADD CONSTRAINT "manual_transaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "transactions"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;
