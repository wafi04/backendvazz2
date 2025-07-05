/*
  Warnings:

  - You are about to drop the column `socket_id` on the `user_activities` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[session_id]` on the table `user_activities` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `session_id` to the `user_activities` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_activities" DROP CONSTRAINT "user_activities_user_id_fkey";

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "deviceInfo" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "user_activities" DROP COLUMN "socket_id",
ADD COLUMN     "session_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_activities_session_id_key" ON "user_activities"("session_id");

-- CreateIndex
CREATE INDEX "user_activities_user_id_session_id_idx" ON "user_activities"("user_id", "session_id");
