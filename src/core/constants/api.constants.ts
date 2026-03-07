export const API_VERSIONS = {
  V1: '1',
  V2: '2'
} as const;

export type ApiVersion = (typeof API_VERSIONS)[keyof typeof API_VERSIONS];

export const DEFAULT_API_VERSION = API_VERSIONS.V1;
