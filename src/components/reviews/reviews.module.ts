import { ReviewController } from '@components/reviews/controllers/review.controller';
import { ReviewDatasource } from '@components/reviews/datasources/review.datasource';
import { ReviewRepository } from '@components/reviews/repositories/review.repository';
import { ReviewStreamService } from '@components/reviews/services/review-stream.service';
import { ReviewService } from '@components/reviews/services/review.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ReviewController],
  providers: [
    ReviewDatasource,
    ReviewRepository,
    ReviewService,
    ReviewStreamService
  ],
  exports: [ReviewService, ReviewStreamService]
})
export class ReviewsModule {}
