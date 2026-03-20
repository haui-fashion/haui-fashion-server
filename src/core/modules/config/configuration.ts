export default () => ({
  app: {
    name: process.env.SERVER_NAME || 'nest-app',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigins: process.env.CORS_ORIGINS || '*'
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
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM || '"No Reply" <noreply@example.com>'
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    models: {
      chat: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
      image: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
      embedding: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
      generation: process.env.GEMINI_GENERATION_MODEL || 'gemini-2.5-flash'
    }
  },
  embedding: {
    embeddingTaskType:
      process.env.PRODUCT_EMBEDDING_TASK_TYPE || 'RETRIEVAL_DOCUMENT'
  }
});
