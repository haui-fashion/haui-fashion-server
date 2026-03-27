import { Prisma } from '@prisma/client';

export const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

export const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return undefined;
};

export const toOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

export const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = toOptionalNumber(value);
  if (parsed == null) {
    return fallback;
  }

  const rounded = Math.floor(parsed);
  if (rounded < 1) {
    return fallback;
  }

  return rounded;
};

export const resolveOrderSort = (
  sortBy: string
): Prisma.OrderOrderByWithRelationInput => {
  switch (sortBy) {
    case 'created_at_asc':
      return { createdAt: 'asc' };
    case 'total_amount_desc':
      return { totalAmount: 'desc' };
    case 'total_amount_asc':
      return { totalAmount: 'asc' };
    case 'created_at_desc':
    default:
      return { createdAt: 'desc' };
  }
};
