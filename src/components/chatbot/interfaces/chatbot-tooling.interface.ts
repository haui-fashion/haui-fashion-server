import { OllamaIntent } from '@core/modules/ollama/interfaces/intent-router.interface';

export type GeminiFunctionCallingMode = 'AUTO' | 'ANY' | 'NONE' | 'VALIDATED';

export type GeminiSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object';

export interface GeminiJsonSchema {
  type: GeminiSchemaType;
  description?: string;
  enum?: string[];
  properties?: Record<string, GeminiJsonSchema>;
  items?: GeminiJsonSchema;
  required?: string[];
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: GeminiJsonSchema;
}

export interface ToolDefinition {
  name: string;
  description: string;
  intents: OllamaIntent[];
  requiresAuth: boolean;
  parameters: GeminiJsonSchema;
}

export interface GeminiToolBundle {
  declarations: GeminiFunctionDeclaration[];
  mode: GeminiFunctionCallingMode;
  allowedFunctionNames: string[];
}

export interface ToolExecutionContext {
  userId?: string;
  sessionId?: string;
  traceId?: string;
  intent: OllamaIntent;
}

export interface ToolExecutionResult {
  ok: boolean;
  data: unknown;
  error: null | {
    code: string;
    message: string;
    suggestion?: string;
  };
  meta?: {
    source?: string;
    latencyMs?: number;
  };
}

export interface ToolInvocationLog {
  name: string;
  args: Record<string, unknown>;
  result: ToolExecutionResult;
}

export interface GeminiToolLoopResult {
  answer: string;
  toolCalls: ToolInvocationLog[];
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}
