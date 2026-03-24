import { Prisma } from '@prisma/client';

export class ProductForEmbedding {
  id: string;
  name: string;
  descriptionHtml: string | null;
  shortDescription: string | null;
  brand: string | null;
  gender: string | null;
  styleTags: Prisma.JsonValue | null;
  material: string | null;
  season: string | null;
  fit: string | null;
  category: {
    name: string;
  } | null;
  isActive: boolean;
  embeddingContentHash: string | null;
}
