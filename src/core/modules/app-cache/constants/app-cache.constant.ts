export const AppCacheKeys = {
  userInfo: (id: string) => {
    return `userInfo_${id}`;
  },
  geminiBlockedKey: (fingerprint: string) => {
    return `gemini:blocked:${fingerprint}`;
  }
};

export const AppCacheTtl = {
  userInfo: 60 * 60 * 1000,
  geminiBlockedKey: 2 * 60 * 1000
};
