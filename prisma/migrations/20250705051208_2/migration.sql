/*
  Warnings:

  - You are about to drop the column `user_id` on the `sessions` table. All the data in the column will be lost.
  - You are about to drop the `accounts` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `username` to the `sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "user_id",
ADD COLUMN     "username" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_active_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "accounts";

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "socket_id" TEXT,
    "is_online" BOOLEAN NOT NULL DEFAULT true,
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_activities_user_id_key" ON "user_activities"("user_id");

-- CreateIndex
CREATE INDEX "user_activities_is_online_last_seen_idx" ON "user_activities"("is_online", "last_seen" DESC);

-- CreateIndex
CREATE INDEX "sessions_username_expires_idx" ON "sessions"("username", "expires");

-- CreateIndex
CREATE INDEX "users_is_online_last_active_at_idx" ON "users"("is_online", "last_active_at" DESC);

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_username_fkey" FOREIGN KEY ("username") REFERENCES "users"("username") ON DELETE CASCADE ON UPDATE CASCADE;
