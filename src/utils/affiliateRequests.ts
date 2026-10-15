import type { ContactMessage } from '../types';

export interface AffiliateRequestForm { name: string; email: string; zaloPhone?: string; facebookUrl: string; }

export function normalizeFacebookUrl(value: string): string | null {
  try {
    const input = value.trim();
    if (!input) return null;
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const host = url.hostname.toLowerCase();
    if (!['facebook.com', 'fb.com', 'fb.me'].some(domain => host === domain || host.endsWith(`.${domain}`)) || url.username || url.password || url.port) return null;
    url.protocol = 'https:';
    return url.href;
  } catch { return null; }
}

export function validateAffiliateRequestStep(form: AffiliateRequestForm, step: 0 | 1): void {
  if (step === 0) {
    const name = form.name.trim(), email = form.email.trim();
    if (!name || name.length > 120) throw new Error('Vui lòng nhập tên của bạn (tối đa 120 ký tự).');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Vui lòng nhập email hợp lệ.');
  } else {
    const facebookUrl = normalizeFacebookUrl(form.facebookUrl);
    if ((form.zaloPhone?.trim().length || 0) > 60) throw new Error('Vui lòng nhập số điện thoại Zalo tối đa 60 ký tự.');
    if (!facebookUrl || facebookUrl.length > 2000) throw new Error('Vui lòng nhập đường dẫn Facebook hợp lệ.');
  }
}

export function buildAffiliateRequest(form: AffiliateRequestForm, id: string, now = new Date()): ContactMessage {
  validateAffiliateRequestStep(form, 0);
  validateAffiliateRequestStep(form, 1);
  const name = form.name.trim(), email = form.email.trim().toLowerCase(), phone = form.zaloPhone?.trim() || '', facebookUrl = normalizeFacebookUrl(form.facebookUrl)!;
  return {
    id, type: 'affiliate_request', name, email, ...(phone ? { phone } : {}), contactInfo: email, facebookUrl,
    message: [`Yêu cầu trở thành affiliate`, `Họ tên: ${name}`, `Email: ${email}`, ...(phone ? [`SĐT Zalo: ${phone}`] : []), `Facebook: ${facebookUrl}`].join('\n'),
    createdAt: now.toISOString(), timestamp: now.getTime(), isRead: false, status: 'unread'
  };
}
