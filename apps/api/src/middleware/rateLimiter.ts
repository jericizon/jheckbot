import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
})

export const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
})

export const messageLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.messageRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages, slow down' },
})
