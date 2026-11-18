export default () => ({
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "4000", 10),
  apiPrefix: process.env.API_PREFIX || "api",
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },
  jwt: {
    secret:
      process.env.JWT_SECRET || "development-jwt-secret-min-16-chars-long",
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    refreshTokenExpiresInDays: parseInt(
      process.env.JWT_REFRESH_EXPIRES_IN_DAYS || "7",
      10,
    ),
  },
  cookie: {
    secret:
      process.env.COOKIE_SECRET || "development-cookie-secret-min-16-chars",
    secure: process.env.NODE_ENV === "production",
    sameSite: (process.env.COOKIE_SAME_SITE || "lax") as "lax" | "strict" | "none",
    domain: process.env.COOKIE_DOMAIN || undefined,
  },
  logLevel: process.env.LOG_LEVEL || "info",
});
