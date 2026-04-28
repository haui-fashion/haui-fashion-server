-- Add SePay as an online payment provider while keeping MoMo for legacy data.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'SEPAY';
