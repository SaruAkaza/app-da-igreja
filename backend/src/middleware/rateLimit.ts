import { Request, Response, NextFunction } from 'express';
export function rateLimit(max = 30, windowMs = 15 * 60 * 1000) {
  const buckets = new Map<string, { count: number; until: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
    const key = req.ip || 'local';
    const bucket = buckets.get(key) || { count: 0, until: now + windowMs };
    bucket.count++;
    buckets.set(key, bucket);
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.until - now) / 1000));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  };
}
