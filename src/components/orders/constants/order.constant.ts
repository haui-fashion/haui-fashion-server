import { EntityCodeOptions } from '@core/modules/prisma';
import { OrderStatus } from '@prisma/client';

export const ORDER_CODE_OPTIONS: EntityCodeOptions = {
  sequenceKey: 'ORDER',
  prefix: 'ORD',
  length: 8
};

export const PAYMENT_CODE_OPTIONS: EntityCodeOptions = {
  sequenceKey: 'PAYMENT',
  prefix: 'PAY',
  length: 8
};

export const MAX_CODE_GENERATION_RETRIES = 5;

export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELED],
  [OrderStatus.PAID]: [
    OrderStatus.TO_DELIVERY,
    OrderStatus.DELIVERING,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELED
  ],
  [OrderStatus.TO_DELIVERY]: [
    OrderStatus.DELIVERING,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELED
  ],
  [OrderStatus.DELIVERING]: [OrderStatus.COMPLETED, OrderStatus.CANCELED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELED]: []
};
