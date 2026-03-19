export class ReviewRecordEntity {
  id: string;
  userId: string;
  productId: string;
  star: number;
  content: string | null;
  imageId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: Record<string, unknown>;
  product?: Record<string, unknown>;
  image?: Record<string, unknown> | null;
}
