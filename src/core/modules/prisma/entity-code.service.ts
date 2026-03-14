import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface EntityCodeOptions {
  sequenceKey: string;
  prefix: string;
  length: number;
}

@Injectable()
export class EntityCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async nextCode(options: EntityCodeOptions): Promise<string> {
    const sequenceKey = options.sequenceKey.trim();
    const prefix = options.prefix.trim();
    const length = options.length;

    if (!sequenceKey) {
      throw new Error('Sequence key cannot be empty');
    }

    if (!prefix) {
      throw new Error('Code prefix cannot be empty');
    }

    if (!Number.isInteger(length) || length <= 0) {
      throw new Error('Code length must be a positive integer');
    }

    const nextSequence = await this.getNextSequenceValue(sequenceKey);
    const maxSequence = 10 ** length - 1;

    if (nextSequence > maxSequence) {
      throw new Error(
        `Code sequence overflow for prefix ${prefix} with length ${length}`
      );
    }

    return `${prefix}-${String(nextSequence).padStart(length, '0')}`;
  }

  private async getNextSequenceValue(sequenceKey: string): Promise<number> {
    const sequence = await this.prisma.entitySequence.upsert({
      where: {
        key: sequenceKey
      },
      create: {
        key: sequenceKey,
        currentValue: 1
      },
      update: {
        currentValue: {
          increment: 1
        }
      },
      select: {
        currentValue: true
      }
    });

    return sequence.currentValue;
  }
}
