import type { ContactMessage } from '../types';

export interface AffiliateRequestForm { name: string; zaloPhone: string; facebookUrl: string; }

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

export function buildAffiliateRequest(form: AffiliateRequestForm, id: string, now = new Date()): ContactMessage {
  const name = form.name.trim(), phone = form.zaloPhone.trim(), facebookUrl = normalizeFacebookUrl(form.facebookUrl);
  if (!name || name.length > 120) throw new Error('Vui lòng nhập tên của bạn (tối đa 120 ký tự).');
  if (!phone || phone.length > 60) throw new Error('Vui lòng nhập số điện thoại Zalo (tối đa 60 ký tự).');
  if (!facebookUrl || facebookUrl.length > 2000) throw new Error('Vui lòng nhập đường dẫn Facebook hợp lệ.');
  return {
    id, type: 'affiliate_request', name, phone, contactInfo: phone, facebookUrl,
    message: `Yêu cầu trở thành affiliate\nHọ tên: ${name}\nSĐT Zalo: ${phone}\nFacebook: ${facebookUrl}`,
    createdAt: now.toISOString(), timestamp: now.getTime(), isRead: false, status: 'unread'
  };
}
