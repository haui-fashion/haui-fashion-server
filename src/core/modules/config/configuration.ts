const parseGeminiKeys = (rawValue?: string): string[] => {
  if (!rawValue) {
    return [];
  }

  const normalized = rawValue
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  return [...new Set(normalized)];
};

const parseBoolean = (rawValue?: string): boolean => {
  if (!rawValue) {
    return false;
  }

  const normalized = rawValue.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

export default () => {
  const configuredGeminiKeys = parseGeminiKeys(process.env.GEMINI_API_KEYS);
  const legacyGeminiKeys = parseGeminiKeys(process.env.GEMINI_API_KEY);
  const ultimateGeminiKey = (process.env.GEMINI_ULTIMATE_API_KEY || '').trim();
  const ultimateOnlyGeminiKey = parseBoolean(process.env.GEMINI_ULTIMATE_ONLY);
  const regularGeminiKeys = (
    configuredGeminiKeys.length > 0 ? configuredGeminiKeys : legacyGeminiKeys
  ).filter((key) => key !== ultimateGeminiKey);

  const primaryGeminiKey =
    regularGeminiKeys[0] || ultimateGeminiKey || legacyGeminiKeys[0] || '';

  return {
    app: {
      name: process.env.SERVER_NAME || 'nest-app',
      env: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      corsOrigins: process.env.CORS_ORIGINS || '*',
      verifyEmailUrl:
        process.env.VERIFY_EMAIL_URL ||
        'https://www.hauifashion.com/verify-email',
      resetPasswordUrl:
        process.env.RESET_PASSWORD_URL ||
        'https://www.hauifashion.com/reset-password'
    },
    timezone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh',
    database: {
      postgres: {
        url: process.env.DATABASE_URL
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10)
      }
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '900',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '604800'
    },
    mail: {
      resendApiKey: process.env.RESEND_API_KEY,
      from: process.env.MAIL_FROM || '"No Reply" <noreply@hauifasion.com>'
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    gemini: {
      apiKey: primaryGeminiKey,
      apiKeys: regularGeminiKeys,
      ultimateApiKey: ultimateGeminiKey,
      ultimateOnly: ultimateOnlyGeminiKey,
      models: {
        chat: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
        image: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
        embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
        generation: process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-flash'
      }
    },
    shipping: {
      ghn: {
        apiToken: process.env.GHN_API_TOKEN,
        baseUrl: 'https://dev-online-gateway.ghn.vn/shiip/',
        timeoutMs: parseInt(process.env.GHN_API_TIMEOUT_MS || '5000', 10),
        shopId: +(process.env.GHN_SHOP_ID || 10000)
      }
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '20000', 10),
      models: {
        router: process.env.OLLAMA_ROUTER_MODEL || 'qwen2.5:3b'
      }
    },
    embedding: {
      embeddingTaskType:
        process.env.PRODUCT_EMBEDDING_TASK_TYPE || 'RETRIEVAL_DOCUMENT',
      serviceUrl: process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8000',
      timeoutMs: parseInt(
        process.env.EMBEDDING_SERVICE_TIMEOUT_MS || '30000',
        10
      ),
      search: {
        semanticWeight: parseFloat(
          process.env.PRODUCT_SEARCH_VECTOR_SEMANTIC_WEIGHT || '0.55'
        ),
        lexicalWeight: parseFloat(
          process.env.PRODUCT_SEARCH_VECTOR_LEXICAL_WEIGHT || '0.45'
        ),
        minSemanticScore: parseFloat(
          process.env.PRODUCT_SEARCH_VECTOR_MIN_SEMANTIC_SCORE || '0.7'
        ),
        rerankCandidateLimit: parseInt(
          process.env.PRODUCT_SEARCH_VECTOR_RERANK_CANDIDATE_LIMIT || '30',
          10
        ),
        rerankWeight: parseFloat(
          process.env.PRODUCT_SEARCH_VECTOR_RERANK_WEIGHT || '0.7'
        ),
        hybridWeight: parseFloat(
          process.env.PRODUCT_SEARCH_VECTOR_HYBRID_WEIGHT || '0.3'
        ),
        rerankTextMaxLength: parseInt(
          process.env.PRODUCT_SEARCH_VECTOR_RERANK_TEXT_MAX_LENGTH || '512',
          10
        ),
        dynamicThreshold: {
          minScore: parseFloat(
            process.env.PRODUCT_SEARCH_VECTOR_DYNAMIC_THRESHOLD_MIN_SCORE ||
              '0.7'
          ),
          topRatio: parseFloat(
            process.env.PRODUCT_SEARCH_VECTOR_DYNAMIC_THRESHOLD_TOP_RATIO ||
              '0.72'
          ),
          maxDrop: parseFloat(
            process.env.PRODUCT_SEARCH_VECTOR_DYNAMIC_THRESHOLD_MAX_DROP ||
              '0.18'
          ),
          minResults: parseInt(
            process.env.PRODUCT_SEARCH_VECTOR_DYNAMIC_THRESHOLD_MIN_RESULTS ||
              '3',
            10
          )
        }
      }
    },
    httpClient: {
      timeoutMs: parseInt(process.env.HTTP_CLIENT_TIMEOUT_MS || '5000', 10),
      maxRedirects: parseInt(process.env.HTTP_CLIENT_MAX_REDIRECTS || '5', 10),
      maxSockets: parseInt(process.env.HTTP_CLIENT_MAX_SOCKETS || '50', 10)
    },
    vnpay: {
      tmnCode: process.env.VNPAY_TMN_CODE || '',
      hashSecret: process.env.VNPAY_HASH_SECRET || '',
      paymentUrl:
        process.env.VNPAY_PAYMENT_URL ||
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      returnUrl: process.env.VNPAY_RETURN_URL || 'http://localhost:3000/orders'
    },
    sepay: {
      env:
        (process.env.SEPAY_ENV as 'sandbox' | 'production' | undefined) ||
        (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'),
      merchantId: process.env.SEPAY_MERCHANT_ID || '',
      secretKey: process.env.SEPAY_SECRET_KEY || '',
      ipnSecretKey:
        process.env.SEPAY_IPN_SECRET_KEY || process.env.SEPAY_SECRET_KEY || '',
      checkoutUrl:
        process.env.SEPAY_CHECKOUT_URL ||
        'https://pay-sandbox.sepay.vn/v1/checkout/init',
      apiBaseUrl:
        process.env.SEPAY_API_BASE_URL || 'https://pgapi-sandbox.sepay.vn',
      returnUrl: process.env.SEPAY_RETURN_URL || 'http://localhost:3000/orders',
      ipnUrl:
        process.env.SEPAY_IPN_URL ||
        'http://localhost:3000/api/v1/orders/sepay-ipn'
    }
  };
};
