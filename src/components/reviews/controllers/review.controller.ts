import { CreateReviewDto } from '@components/reviews/dtos/create-review.dto';
import { QueryReviewDto } from '@components/reviews/dtos/query-review.dto';
import { ReviewStreamService } from '@components/reviews/services/review-stream.service';
import { ReviewService } from '@components/reviews/services/review.service';
import {
  CurrentUser,
  CurrentUserDto,
  Public
} from '@core/utilities/decorators';
import { SkipTransformResponse } from '@core/utilities/interceptors';
import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

@ApiTags('Reviews')
@Controller({ path: 'reviews', version: '1' })
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly reviewStreamService: ReviewStreamService
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new review for a product' })
  async create(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateReviewDto
  ) {
    return this.reviewService.create(user, dto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all reviews with pagination, sorting, and filtering'
  })
  async findAll(@Query() query: QueryReviewDto) {
    return this.reviewService.findAll(query);
  }

  @Sse('stream')
  @Public()
  @SkipTransformResponse()
  @ApiOperation({ summary: 'SSE stream for newly created reviews' })
  stream(@Query('productId') productId?: string): Observable<MessageEvent> {
    return this.reviewStreamService.stream(productId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a review by ID' })
  async findOne(@Param('id') id: string) {
    return this.reviewService.findById(id);
  }
}
