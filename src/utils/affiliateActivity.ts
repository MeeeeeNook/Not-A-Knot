import type { AffiliateActivityEntry } from '../types';

export const AFFILIATE_ACTIVITY_LIMIT = 100;
export const affiliateActivityLabels = {
  login: 'Đăng nhập Google', hub_open: 'Mở Affiliate Hub', tab_view: 'Xem mục',
  orders_refresh: 'Cập nhật danh sách đơn', profile_update: 'Lưu thông tin tài khoản',
  payment_qr: 'Tạo QR nhận hoa hồng', logout: 'Đăng xuất'
};
export const affiliateTabLabels: Record<string, string> = {
  overview: 'Tổng quan', orders: 'Đơn hàng', analytics: 'Thống kê', links: 'Link & Công cụ', guide: 'Hướng dẫn', settings: 'Cài đặt'
};

export function validAccountDate(value: unknown): string {
  if (typeof value === 'string' && value && Number.isFinite(Date.parse(value))) return value;
  if (value && typeof (value as any).toDate === 'function') return validAccountDate((value as any).toDate().toISOString());
  return '';
}

export function mergeAffiliateActivity(history: unknown, entry?: AffiliateActivityEntry): AffiliateActivityEntry[] {
  const rows = Array.isArray(history) ? history.filter(row => row && typeof row.id === 'string' && Object.hasOwn(affiliateActivityLabels, row.action) && validAccountDate(row.timestamp)) : [];
  const unique = new Map<string, AffiliateActivityEntry>();
  for (const row of [...rows, ...(entry ? [entry] : [])]) unique.set(row.id, row);
  return [...unique.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, AFFILIATE_ACTIVITY_LIMIT);
}

export function formatAffiliateAccountDate(value: unknown): string {
  const date = validAccountDate(value);
  return date ? new Date(date).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }) : 'Chưa ghi nhận';
}
