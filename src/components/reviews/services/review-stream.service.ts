import {
  REVIEW_CREATED_EVENT,
  ReviewCreatedEventPayload
} from '@components/reviews/constants/review.constant';
import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { filter, Observable, Subject } from 'rxjs';

@Injectable()
export class ReviewStreamService implements OnModuleDestroy {
  private readonly streamSubject = new Subject<MessageEvent>();

  @OnEvent(REVIEW_CREATED_EVENT)
  handleReviewCreated(payload: ReviewCreatedEventPayload) {
    this.streamSubject.next({
      type: REVIEW_CREATED_EVENT,
      data: payload
    });
  }

  stream(productId?: string): Observable<MessageEvent> {
    if (!productId) {
      return this.streamSubject.asObservable();
    }

    return this.streamSubject.asObservable().pipe(
      filter((event) => {
        const data = event.data as ReviewCreatedEventPayload | undefined;
        return !!data && data.productId === productId;
      })
    );
  }

  onModuleDestroy() {
    this.streamSubject.complete();
  }
}
