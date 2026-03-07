import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  Type
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

// ============================================================================
// Validation Options
// ============================================================================

export interface ValidationPipeOptions {
  /**
   * If true, strips properties not defined in the DTO
   * @default true
   */
  whitelist?: boolean;

  /**
   * If true, throws an error if non-whitelisted properties are present
   * @default false
   */
  forbidNonWhitelisted?: boolean;

  /**
   * If true, transforms the plain object to the DTO class instance
   * @default true
   */
  transform?: boolean;

  /**
   * Groups to use for validation
   */
  groups?: string[];

  /**
   * Skip validation for missing properties
   * @default false
   */
  skipMissingProperties?: boolean;

  /**
   * Skip undefined properties during validation
   * @default false
   */
  skipUndefinedProperties?: boolean;

  /**
   * Skip null properties during validation
   * @default false
   */
  skipNullProperties?: boolean;
}

// ============================================================================
// Validation Pipe
// ============================================================================

@Injectable()
export class ValidationPipe implements PipeTransform {
  private readonly options: ValidationPipeOptions;

  constructor(options: ValidationPipeOptions = {}) {
    this.options = {
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      skipMissingProperties: false,
      skipUndefinedProperties: false,
      skipNullProperties: false,
      ...options
    };
  }

  async transform(
    value: unknown,
    metadata: ArgumentMetadata
  ): Promise<unknown> {
    const { metatype } = metadata;

    // Skip validation if no metatype or if it's a native type
    if (!metatype || this.isNativeType(metatype)) {
      return value;
    }

    // Skip validation for null/undefined when transforming
    if (value === null || value === undefined) {
      return value;
    }

    // Transform plain object to class instance
    const object = plainToInstance(metatype, value as Record<string, unknown>, {
      enableImplicitConversion: true
    }) as object;

    // Validate the object
    const errors = await validate(object, {
      whitelist: this.options.whitelist,
      forbidNonWhitelisted: this.options.forbidNonWhitelisted,
      groups: this.options.groups,
      skipMissingProperties: this.options.skipMissingProperties,
      skipUndefinedProperties: this.options.skipUndefinedProperties,
      skipNullProperties: this.options.skipNullProperties
    });

    if (errors.length > 0) {
      throw new BadRequestException({
        message: this.formatErrors(errors),
        error: 'Validation Error'
      });
    }

    return this.options.transform ? object : value;
  }

  private isNativeType(metatype: Type<unknown>): boolean {
    const nativeTypes: Type<unknown>[] = [
      String,
      Boolean,
      Number,
      Array,
      Object
    ];
    return nativeTypes.includes(metatype);
  }

  private formatErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => this.extractMessages(error));
  }

  private extractMessages(error: ValidationError, parentPath = ''): string[] {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const messages: string[] = [];

    // Get constraint messages for this error
    if (error.constraints) {
      messages.push(
        ...Object.values(error.constraints).map(
          (msg) => `${propertyPath}: ${msg}`
        )
      );
    }

    // Recursively get messages from child errors
    if (error.children && error.children.length > 0) {
      messages.push(
        ...error.children.flatMap((child) =>
          this.extractMessages(child, propertyPath)
        )
      );
    }

    return messages;
  }
}
