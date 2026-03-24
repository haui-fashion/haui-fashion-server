export class LocalEmbeddingPersistInput {
  productId: string;
  contentHash: string;
  embeddingInput: string;
  shortDescription: string;
  semanticContext: string;
  embedding: number[];
}
