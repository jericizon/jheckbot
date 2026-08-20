import rateLimit from 'express-rate-limit'

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages, slow down' },
})
