import type { NextFunction, Request, RequestHandler, Response } from 'express'

export function logError(scope: string, err: unknown, req?: Request): void {
  const e = err instanceof Error ? err : new Error(String(err))
  const method = req?.method ?? '-'
  const url = req?.originalUrl ?? '-'
  console.error(`[electrical-room-api] ${scope} ${method} ${url}:`, e.message)
  if (e.stack) console.error(e.stack)
}

export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(err => next(err))
  }
}

export function unhandledErrorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const e = err as Error & { status?: number }
  logError('unhandled', err, req)
  if (res.headersSent) return
  res.status(e.status ?? 500).json({ error: e.message || 'internal error' })
}
