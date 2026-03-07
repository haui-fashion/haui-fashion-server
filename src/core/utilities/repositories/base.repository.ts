import { BaseEntity } from '@core/utilities/entities';
import { ClassConstructor, plainToInstance } from 'class-transformer';

export abstract class BaseRepository<E extends BaseEntity, M> {
  private readonly e: ClassConstructor<E>;
  constructor(e: ClassConstructor<E>) {
    this.e = e;
  }

  protected toEntity(model: M) {
    return plainToInstance(this.e, model, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true
    });
  }

  protected toEntities(models: M[]) {
    return models.map((e) => this.toEntity(e));
  }
}
