import {
  FilterDto,
  FilterOperator,
  FilterValueType
} from '@common/dtos/base-query.dto';
import { BadRequestException } from '@nestjs/common';

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  throw new BadRequestException(
    `Giá trị boolean không hợp lệ: ${String(value)}`
  );
}

function parseNumberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new BadRequestException(
    `Giá trị number không hợp lệ: ${String(value)}`
  );
}

function parseDateValue(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `Giá trị date không hợp lệ: ${String(value)}`
    );
  }

  return parsed;
}

function parseStringValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  throw new BadRequestException('Giá trị string không hợp lệ');
}

function parseByType(value: unknown, type: FilterValueType): unknown {
  switch (type) {
    case FilterValueType.BOOLEAN:
      return parseBoolean(value);
    case FilterValueType.NUMBER:
      return parseNumberValue(value);
    case FilterValueType.DATE:
      return parseDateValue(value);
    case FilterValueType.STRING:
    default:
      return parseStringValue(value);
  }
}

function ensureArray(
  values: unknown[] | undefined,
  operator: FilterOperator
): unknown[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new BadRequestException(
      `Toán tử ${operator} yêu cầu mảng values có ít nhất 1 phần tử`
    );
  }

  return values;
}

function buildColumnCondition(
  column: string,
  leafCondition: unknown
): Record<string, unknown> {
  const parts = column
    .split('.')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    throw new BadRequestException('Cột lọc không hợp lệ');
  }

  return parts.reduceRight<Record<string, unknown>>(
    (acc, key) => ({ [key]: acc }),
    leafCondition as Record<string, unknown>
  );
}

export function buildPrismaWhereFromFilters(
  filters?: FilterDto[]
): Record<string, unknown> {
  if (!filters?.length) {
    return {};
  }

  const andConditions: Record<string, unknown>[] = [];

  for (const filter of filters) {
    const column = filter.column?.trim();
    if (!column) {
      throw new BadRequestException('Cột lọc không hợp lệ');
    }

    const operator = filter.operator ?? FilterOperator.EQ;
    const type = filter.type ?? FilterValueType.STRING;
    const values = filter.values;

    switch (operator) {
      case FilterOperator.EQ: {
        andConditions.push(
          buildColumnCondition(column, parseByType(filter.value, type))
        );
        break;
      }
      case FilterOperator.CONTAINS: {
        const value = parseStringValue(filter.value);
        andConditions.push(
          buildColumnCondition(column, {
            contains: value,
            mode: 'insensitive'
          })
        );
        break;
      }
      case FilterOperator.GT: {
        andConditions.push(
          buildColumnCondition(column, {
            gt: parseByType(filter.value, type)
          })
        );
        break;
      }
      case FilterOperator.LT: {
        andConditions.push(
          buildColumnCondition(column, {
            lt: parseByType(filter.value, type)
          })
        );
        break;
      }
      case FilterOperator.IN: {
        const parsedValues = ensureArray(values, operator).map((value) =>
          parseByType(value, type)
        );
        andConditions.push(
          buildColumnCondition(column, {
            in: parsedValues
          })
        );
        break;
      }
      case FilterOperator.BETWEEN: {
        const betweenValues = ensureArray(values, operator);
        if (betweenValues.length !== 2) {
          throw new BadRequestException(
            'Toán tử between yêu cầu values có đúng 2 phần tử'
          );
        }

        const [start, end] = betweenValues.map((value) =>
          parseByType(value, type)
        );
        andConditions.push(
          buildColumnCondition(column, {
            gte: start,
            lte: end
          })
        );
        break;
      }
      default:
        throw new BadRequestException(
          `Toán tử lọc không được hỗ trợ: ${operator as string}`
        );
    }
  }

  return {
    AND: andConditions
  };
}
