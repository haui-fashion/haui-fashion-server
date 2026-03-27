ALTER TABLE "orders"
ADD COLUMN "total_product_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
ADD COLUMN "shipping_fee" DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE "orders"
SET "total_product_amount" = "total_amount"
WHERE "total_product_amount" = 0;
