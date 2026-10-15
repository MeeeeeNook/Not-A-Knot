import { isIP } from 'node:net';

// Vercel supplies these headers. Never accept an IP in a query or request body.
// https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for
export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'X-Vercel-Forwarded-For, X-Forwarded-For');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  const header = req.headers?.['x-vercel-forwarded-for'] || req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'];
  const raw = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  const candidate = raw.replace(/^::ffff:/, '');
  const ip = isIP(candidate) ? candidate : '';
  return res.status(200).json({ ip, timestamp: new Date().toISOString() });
}
