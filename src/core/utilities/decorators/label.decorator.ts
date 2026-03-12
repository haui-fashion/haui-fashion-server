import 'reflect-metadata';

export const LABEL_METADATA_KEY = 'field_label';

export const Label =
  (label: string): PropertyDecorator =>
  (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(LABEL_METADATA_KEY, label, target, propertyKey);
  };
