export const AppCacheKeys = {
  userInfo: (id: string) => {
    return `userInfo_${id}`;
  },
  emailVerification: (token: string) => {
    return `email_verification:${token}`;
  },
  emailVerificationCooldown: (email: string) => {
    return `email_verification_cooldown:${email}`;
  },
  passwordReset: (token: string) => {
    return `password_reset:${token}`;
  },
  passwordResetCooldown: (email: string) => {
    return `password_reset_cooldown:${email}`;
  },
  blacklistedToken: (token: string) => {
    return `auth:blacklisted_token:${token}`;
  },
  geminiBlockedKey: (fingerprint: string) => {
    return `gemini:blocked:${fingerprint}`;
  },
  geminiInUseKey: (fingerprint: string) => {
    return `gemini:in-use:${fingerprint}`;
  }
};

export const AppCacheTtl = {
  userInfo: 60 * 60 * 1000,
  emailVerification: 24 * 60 * 60 * 1000,
  emailVerificationCooldown: 60 * 1000,
  passwordReset: 15 * 60 * 1000,
  passwordResetCooldown: 5 * 60 * 1000,
  geminiBlockedKey: 2 * 60 * 1000,
  geminiInUseKey: 10 * 1000
};
