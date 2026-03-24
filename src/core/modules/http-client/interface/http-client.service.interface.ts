export type HttpClientRequestOptions = {
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  timeoutMs?: number;
};

export interface HttpClientServiceInterface {
  get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: HttpClientRequestOptions
  ): Promise<T>;
  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientRequestOptions
  ): Promise<T>;
  put<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientRequestOptions
  ): Promise<T>;
  delete<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: HttpClientRequestOptions
  ): Promise<T>;
}
