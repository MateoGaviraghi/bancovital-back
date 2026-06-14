export interface RequestMeta {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export function clientIp(req: RequestMeta): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) {
    const first = Array.isArray(fwd) ? fwd[0] : fwd.split(',')[0];
    if (first) return first.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

export function userAgent(req: RequestMeta): string | null {
  const ua = req.headers['user-agent'];
  if (!ua) return null;
  return Array.isArray(ua) ? (ua[0] ?? null) : ua;
}
