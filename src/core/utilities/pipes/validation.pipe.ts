import { LABEL_METADATA_KEY } from '@core/utilities/decorators/label.decorator';
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
  private readonly constraintMessages: Record<
    string,
    (args: { field: string; constraintText?: string }) => string
  > = {
    isString: ({ field }) => `${field} phải là chuỗi`,
    isNotEmpty: ({ field }) => `${field} không được để trống`,
    isEmail: ({ field }) => `${field} phải là email hợp lệ`,
    isEnum: ({ field, constraintText }) => {
      const allowed = constraintText?.split(':')?.[1]?.trim();
      return allowed
        ? `${field} phải thuộc một trong các giá trị: ${allowed}`
        : `${field} không hợp lệ`;
    },
    minLength: ({ field, constraintText }) => {
      const match = constraintText?.match(/\d+/)?.[0];
      return match
        ? `${field} phải có tối thiểu ${match} ký tự`
        : `${field} không đủ độ dài tối thiểu`;
    },
    maxLength: ({ field, constraintText }) => {
      const match = constraintText?.match(/\d+/)?.[0];
      return match
        ? `${field} phải có tối đa ${match} ký tự`
        : `${field} vượt quá độ dài cho phép`;
    },
    length: ({ field, constraintText }) => {
      const nums = constraintText?.match(/\d+/g);
      if (nums && nums.length >= 2) {
        return `${field} phải có độ dài từ ${nums[0]} đến ${nums[1]} ký tự`;
      }
      return `${field} không đúng độ dài yêu cầu`;
    },
    isBoolean: ({ field }) => `${field} phải là giá trị boolean`,
    isNumber: ({ field }) => `${field} phải là số`,
    isInt: ({ field }) => `${field} phải là số nguyên`,
    isPositive: ({ field }) => `${field} phải là số dương`,
    isNegative: ({ field }) => `${field} phải là số âm`,
    min: ({ field, constraintText }) => {
      const match = constraintText?.match(/\d+/)?.[0];
      return match
        ? `${field} phải lớn hơn hoặc bằng ${match}`
        : `${field} nhỏ hơn giá trị cho phép`;
    },
    max: ({ field, constraintText }) => {
      const match = constraintText?.match(/\d+/)?.[0];
      return match
        ? `${field} phải nhỏ hơn hoặc bằng ${match}`
        : `${field} vượt quá giá trị cho phép`;
    },
    isDateString: ({ field }) => `${field} phải là ngày hợp lệ`,
    isUUID: ({ field }) => `${field} phải là UUID hợp lệ`,
    isPhoneNumber: ({ field }) => `${field} phải là số điện thoại hợp lệ`,
    isUrl: ({ field }) => `${field} phải là URL hợp lệ`,
    isArray: ({ field }) => `${field} phải là mảng`,
    arrayMinSize: ({ field, constraintText }) => {
      const match = constraintText?.match(/\d+/)?.[0];
      return match
        ? `${field} phải có ít nhất ${match} phần tử`
        : `${field} không đủ số lượng phần tử`;
    },
    arrayMaxSize: ({ field, constraintText }) => {
      const match = constraintText?.match(/\d+/)?.[0];
      return match
        ? `${field} chỉ được có tối đa ${match} phần tử`
        : `${field} vượt quá số lượng phần tử cho phép`;
    },
    matches: ({ field }) => `${field} không đúng định dạng yêu cầu`
  };

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
        error: 'Lỗi xác thực dữ liệu'
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

  private extractMessages(
    error: ValidationError,
    parentPath = '',
    targetPrototype?: object
  ): string[] {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const currentTarget = error.target
      ? Object.getPrototypeOf(error.target)
      : targetPrototype;
    const label = this.getLabel(currentTarget, error.property);
    const fieldName = label ?? propertyPath;

    const messages: string[] = [];

    if (error.constraints) {
      messages.push(
        ...Object.entries(error.constraints).map(([key, constraintText]) =>
          this.formatConstraintMessage(key, fieldName, constraintText)
        )
      );
    }

    if (error.children && error.children.length > 0) {
      messages.push(
        ...error.children.flatMap((child) =>
          this.extractMessages(child, propertyPath, currentTarget)
        )
      );
    }

    return messages;
  }

  private formatConstraintMessage(
    constraintKey: string,
    field: string,
    constraintText?: string
  ): string {
    const formatter = this.constraintMessages[constraintKey];
    if (formatter) {
      return formatter({ field, constraintText });
    }
    return `${field}: ${constraintText ?? 'không hợp lệ'}`;
  }

  private getLabel(
    target: object | undefined,
    propertyKey: string
  ): string | undefined {
    if (!target) return undefined;
    return Reflect.getMetadata(LABEL_METADATA_KEY, target, propertyKey) as
      | string
      | undefined;
  }
}
