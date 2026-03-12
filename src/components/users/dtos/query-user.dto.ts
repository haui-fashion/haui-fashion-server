import { BaseQueryDto } from '@common/dtos/base-query.dto';
import { Label } from '@core/utilities/decorators/label.decorator';

export class QueryUserDto extends BaseQueryDto {
  @Label('Trang')
  page?: number;

  @Label('Số bản ghi')
  limit?: number;
}
