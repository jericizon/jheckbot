import type { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err.message)

  // Don't leak internal errors to clients
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500
  const message = statusCode >= 500 ? 'Internal server error' : err.message

  res.status(statusCode).json({ error: message })
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' })
}
