export class TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export class TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export class TiptapDocument {
  type: 'doc';
  content?: TiptapNode[];
}
