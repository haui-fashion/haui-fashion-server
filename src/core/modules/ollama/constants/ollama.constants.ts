export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';
export const OLLAMA_DEFAULT_TIMEOUT_MS = 5000;
export const OLLAMA_ROUTER_MODEL = 'qwen2.5:3b';

export const OLLAMA_CONFIG_PATHS = {
  baseUrl: 'ollama.baseUrl',
  timeoutMs: 'ollama.timeoutMs',
  routerModel: 'ollama.models.router'
} as const;
