export const AppCacheKeys = {
  userInfo: (id: string) => {
    return `userInfo_${id}`;
  }
};

export const AppCacheTtl = {
  userInfo: 60 * 60 * 1000
};
