import { EntityCodeOptions } from '@core/modules/prisma';

export const USER_CODE_OPTIONS: EntityCodeOptions = {
  sequenceKey: 'USER',
  prefix: 'USER',
  length: 7
};

export const MAX_CODE_GENERATION_RETRIES = 5;
