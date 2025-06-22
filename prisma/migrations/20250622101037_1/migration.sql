-- CreateTable
CREATE TABLE "news" (
    "id" SERIAL NOT NULL,
    "path" TEXT NOT NULL,
    "is_active" TEXT NOT NULL DEFAULT 'active',
    "type" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "deposit_id" VARCHAR(100),
    "payment_reference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "log" TEXT,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sub_name" VARCHAR(200) NOT NULL,
    "brand" TEXT NOT NULL,
    "code" VARCHAR(50),
    "is_check_nickname" VARCHAR(10) NOT NULL DEFAULT 'active',
    "status" VARCHAR(10) NOT NULL DEFAULT 'active',
    "thumbnail" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'game',
    "instruction" TEXT,
    "information" TEXT,
    "placeholder_1" TEXT NOT NULL,
    "placeholder_2" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "banner" VARCHAR(500) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "sub_category_id" INTEGER NOT NULL DEFAULT 1,
    "provider_id" VARCHAR(100) NOT NULL,
    "service_name" VARCHAR(300) NOT NULL,
    "price" INTEGER NOT NULL,
    "price_from_digi" INTEGER NOT NULL,
    "price_reseller" INTEGER NOT NULL,
    "price_platinum" INTEGER NOT NULL,
    "price_flash_sale" INTEGER DEFAULT 0,
    "price_suggest" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,
    "profit_reseller" INTEGER NOT NULL,
    "profit_platinum" INTEGER NOT NULL,
    "profit_suggest" INTEGER NOT NULL,
    "is_profit_fixed" VARCHAR(10) NOT NULL DEFAULT 'false',
    "is_flash_sale" VARCHAR(10) NOT NULL DEFAULT 'false',
    "is_suggest" VARCHAR(10) NOT NULL DEFAULT 'false',
    "title_flash_sale" VARCHAR(255),
    "banner_flash_sale" VARCHAR(255),
    "expired_flash_sale" DATE,
    "note" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" VARCHAR(100) NOT NULL,
    "product_logo" VARCHAR(500),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(55) NOT NULL,
    "image" VARCHAR(250) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(250) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "min_amount" INTEGER,
    "is_active" VARCHAR(10) NOT NULL DEFAULT 'active',
    "tax_type" VARCHAR(20),
    "tax_admin" DOUBLE PRECISION,
    "min_expired" INTEGER DEFAULT 0,
    "max_expired" INTEGER DEFAULT 0,
    "max_amount" INTEGER,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "price" VARCHAR(20) NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "payment_number" TEXT,
    "buyer_number" VARCHAR(50) NOT NULL,
    "fee" INTEGER,
    "fee_amount" INTEGER,
    "status" VARCHAR(20) NOT NULL,
    "method" VARCHAR(50) NOT NULL,
    "reference" VARCHAR(200),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "username" VARCHAR(100),
    "purchase_price" INTEGER,
    "discount" INTEGER,
    "user_id" VARCHAR(50),
    "zone" VARCHAR(50),
    "nickname" VARCHAR(100),
    "service_name" VARCHAR(300) NOT NULL,
    "price" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL,
    "message" TEXT,
    "profit_amount" INTEGER NOT NULL,
    "provider_order_id" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL,
    "log" VARCHAR(2000),
    "serial_number" TEXT,
    "is_re_order" VARCHAR(10) NOT NULL DEFAULT 'false',
    "transaction_type" VARCHAR(20) NOT NULL DEFAULT 'game',
    "is_digi" VARCHAR(10) NOT NULL,
    "ref_id" VARCHAR(100),
    "success_report_sent" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualTransaction" (
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

    CONSTRAINT "ManualTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "benefit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_categories" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "is_active" VARCHAR(10) NOT NULL,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password" VARCHAR(200) NOT NULL,
    "whatsapp" VARCHAR(20),
    "balance" INTEGER NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "otp" VARCHAR(6),
    "api_key" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_payment_at" TIMESTAMP(3) NOT NULL,
    "token" VARCHAR(500),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "discountType" VARCHAR(20) NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxDiscount" DOUBLE PRECISION,
    "minPurchase" DOUBLE PRECISION,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "is_for_all_categories" VARCHAR(10) NOT NULL DEFAULT 'false',
    "is_active" VARCHAR(10) NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiry_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_categories" (
    "id" SERIAL NOT NULL,
    "voucher_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "voucher_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voucher_usages" (
    "id" SERIAL NOT NULL,
    "voucher_id" INTEGER NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "username" VARCHAR(100),
    "whatsapp" VARCHAR(20),
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "voucher_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "text" TEXT NOT NULL,
    "details" JSONB NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" INTEGER NOT NULL,
    "parent_log_id" TEXT,
    "order_id" TEXT,
    "ref" TEXT,
    "type" VARCHAR(20) NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "error_message" TEXT,
    "metadata" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_balances" (
    "id" SERIAL NOT NULL,
    "platform_name" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_number" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "is_active" VARCHAR(10) NOT NULL DEFAULT 'active',
    "api_endpoint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_histories" (
    "id" SERIAL NOT NULL,
    "platform_id" INTEGER NOT NULL,
    "batch_id" TEXT,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "amount_changed" INTEGER NOT NULL,
    "change_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "news_type_created_at_idx" ON "news"("type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "news_created_at_type_idx" ON "news"("created_at" DESC, "type");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_deposit_id_key" ON "deposits"("deposit_id");

-- CreateIndex
CREATE INDEX "deposits_username_status_created_at_idx" ON "deposits"("username", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deposits_status_created_at_idx" ON "deposits"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deposits_method_status_created_at_idx" ON "deposits"("method", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deposits_amount_status_created_at_idx" ON "deposits"("amount", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "deposits_payment_reference_idx" ON "deposits"("payment_reference");

-- CreateIndex
CREATE INDEX "deposits_deposit_id_idx" ON "deposits"("deposit_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "categories_type_status_name_idx" ON "categories"("type", "status", "name");

-- CreateIndex
CREATE INDEX "categories_status_brand_name_idx" ON "categories"("status", "brand", "name");

-- CreateIndex
CREATE INDEX "categories_code_status_idx" ON "categories"("code", "status");

-- CreateIndex
CREATE INDEX "services_category_id_status_price_idx" ON "services"("category_id", "status", "price");

-- CreateIndex
CREATE INDEX "services_sub_category_id_status_price_idx" ON "services"("sub_category_id", "status", "price");

-- CreateIndex
CREATE INDEX "services_provider_id_status_idx" ON "services"("provider_id", "status");

-- CreateIndex
CREATE INDEX "services_is_flash_sale_expired_flash_sale_status_idx" ON "services"("is_flash_sale", "expired_flash_sale", "status");

-- CreateIndex
CREATE INDEX "services_is_suggest_status_price_idx" ON "services"("is_suggest", "status", "price");

-- CreateIndex
CREATE INDEX "services_status_price_idx" ON "services"("status", "price");

-- CreateIndex
CREATE INDEX "services_provider_status_created_at_idx" ON "services"("provider", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "services_category_id_status_is_flash_sale_idx" ON "services"("category_id", "status", "is_flash_sale");

-- CreateIndex
CREATE INDEX "payment_methods_code_is_active_idx" ON "payment_methods"("code", "is_active");

-- CreateIndex
CREATE INDEX "payment_methods_name_is_active_idx" ON "payment_methods"("name", "is_active");

-- CreateIndex
CREATE INDEX "payment_methods_type_is_active_idx" ON "payment_methods"("type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_method_status_idx" ON "payments"("method", "status");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_buyer_number_status_idx" ON "payments"("buyer_number", "status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_order_id_key" ON "transactions"("order_id");

-- CreateIndex
CREATE INDEX "transactions_username_status_created_at_idx" ON "transactions"("username", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_status_created_at_idx" ON "transactions"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_created_at_status_idx" ON "transactions"("created_at" DESC, "status");

-- CreateIndex
CREATE INDEX "transactions_is_digi_status_created_at_idx" ON "transactions"("is_digi", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_transaction_type_status_created_at_idx" ON "transactions"("transaction_type", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_order_id_username_idx" ON "transactions"("order_id", "username");

-- CreateIndex
CREATE INDEX "transactions_provider_order_id_status_idx" ON "transactions"("provider_order_id", "status");

-- CreateIndex
CREATE INDEX "transactions_user_id_status_idx" ON "transactions"("user_id", "status");

-- CreateIndex
CREATE INDEX "ManualTransaction_status_created_at_idx" ON "ManualTransaction"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ManualTransaction_order_id_status_idx" ON "ManualTransaction"("order_id", "status");

-- CreateIndex
CREATE INDEX "ManualTransaction_user_id_status_idx" ON "ManualTransaction"("user_id", "status");

-- CreateIndex
CREATE INDEX "ManualTransaction_created_by_status_idx" ON "ManualTransaction"("created_by", "status");

-- CreateIndex
CREATE INDEX "Membership_price_idx" ON "Membership"("price");

-- CreateIndex
CREATE INDEX "Membership_name_idx" ON "Membership"("name");

-- CreateIndex
CREATE INDEX "sub_categories_category_id_is_active_idx" ON "sub_categories"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "sub_categories_code_is_active_idx" ON "sub_categories"("code", "is_active");

-- CreateIndex
CREATE INDEX "sub_categories_is_active_name_idx" ON "sub_categories"("is_active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_role_idx" ON "users"("username", "role");

-- CreateIndex
CREATE INDEX "users_role_balance_idx" ON "users"("role", "balance" DESC);

-- CreateIndex
CREATE INDEX "users_whatsapp_idx" ON "users"("whatsapp");

-- CreateIndex
CREATE INDEX "users_api_key_idx" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "users_balance_role_idx" ON "users"("balance" DESC, "role");

-- CreateIndex
CREATE INDEX "users_last_payment_at_idx" ON "users"("last_payment_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_code_is_active_idx" ON "vouchers"("code", "is_active");

-- CreateIndex
CREATE INDEX "vouchers_is_active_expiry_date_idx" ON "vouchers"("is_active", "expiry_date");

-- CreateIndex
CREATE INDEX "vouchers_start_date_expiry_date_is_active_idx" ON "vouchers"("start_date", "expiry_date", "is_active");

-- CreateIndex
CREATE INDEX "vouchers_discountType_is_active_idx" ON "vouchers"("discountType", "is_active");

-- CreateIndex
CREATE INDEX "voucher_categories_voucher_id_idx" ON "voucher_categories"("voucher_id");

-- CreateIndex
CREATE INDEX "voucher_categories_category_id_idx" ON "voucher_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "voucher_categories_voucher_id_category_id_key" ON "voucher_categories"("voucher_id", "category_id");

-- CreateIndex
CREATE INDEX "voucher_usages_voucher_id_created_at_idx" ON "voucher_usages"("voucher_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "voucher_usages_order_id_idx" ON "voucher_usages"("order_id");

-- CreateIndex
CREATE INDEX "voucher_usages_username_created_at_idx" ON "voucher_usages"("username", "created_at" DESC);

-- CreateIndex
CREATE INDEX "voucher_usages_whatsapp_created_at_idx" ON "voucher_usages"("whatsapp", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_title_idx" ON "messages"("title");

-- CreateIndex
CREATE INDEX "system_logs_parent_log_id_idx" ON "system_logs"("parent_log_id");

-- CreateIndex
CREATE INDEX "system_logs_order_id_idx" ON "system_logs"("order_id");

-- CreateIndex
CREATE INDEX "system_logs_type_idx" ON "system_logs"("type");

-- CreateIndex
CREATE INDEX "system_logs_order_id_type_idx" ON "system_logs"("order_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "platform_balances_platform_name_key" ON "platform_balances"("platform_name");

-- CreateIndex
CREATE INDEX "platform_balances_platform_name_is_active_idx" ON "platform_balances"("platform_name", "is_active");

-- CreateIndex
CREATE INDEX "balance_histories_platform_id_created_at_idx" ON "balance_histories"("platform_id", "created_at");

-- CreateIndex
CREATE INDEX "balance_histories_batch_id_idx" ON "balance_histories"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_username_fkey" FOREIGN KEY ("username") REFERENCES "users"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "payments"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_username_fkey" FOREIGN KEY ("username") REFERENCES "users"("username") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTransaction" ADD CONSTRAINT "ManualTransaction_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "transactions"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_categories" ADD CONSTRAINT "voucher_categories_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_categories" ADD CONSTRAINT "voucher_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_usages" ADD CONSTRAINT "voucher_usages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "transactions"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_histories" ADD CONSTRAINT "balance_histories_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
