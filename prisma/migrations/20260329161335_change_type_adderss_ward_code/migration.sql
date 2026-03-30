-- AlterTable
ALTER TABLE "addresses" ALTER COLUMN "ward_code" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "total_product_amount" DROP DEFAULT,
ALTER COLUMN "shipping_fee" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
