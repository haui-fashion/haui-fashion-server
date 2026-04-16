export const REVIEW_CREATED_EVENT = 'review.created';

export class ReviewCreatedEventPayload {
  id: string;
  userId: string;
  productId: string;
  star: number;
  content: string | null;
  createdAt: Date;
}
