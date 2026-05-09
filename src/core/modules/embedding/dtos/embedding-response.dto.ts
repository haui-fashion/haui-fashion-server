export class EmbeddingResponse {
  model: string;
  dimension: number;
  embeddings: number[][];
}

export class RerankResponse {
  model: string;
  scores: number[];
}
