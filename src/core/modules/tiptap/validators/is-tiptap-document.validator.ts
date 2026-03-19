import {
  ValidationArguments,
  ValidationOptions,
  registerDecorator
} from 'class-validator';

export function IsTiptapDocument(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTiptapDocument',
      target: object.constructor,
      propertyName: propertyName,
      options: {
        message: `${propertyName} phải là một Tiptap document hợp lệ (JSON object với type = "doc")`,
        ...validationOptions
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          if (value === null || value === undefined) return true;

          if (typeof value !== 'object' || Array.isArray(value)) return false;

          const doc = value as Record<string, unknown>;

          if (doc.type !== 'doc') return false;

          if (doc.content !== undefined && !Array.isArray(doc.content)) {
            return false;
          }

          return true;
        }
      }
    });
  };
}
