import { validAccountDate } from './affiliateActivity';

export function shortAccountDate(value: unknown): string {
  const date = validAccountDate(value);
  return date ? new Date(date).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa ghi nhận';
}

export function relativeAccountTime(value: unknown, now = Date.now()): string {
  const date = validAccountDate(value);
  if (!date) return 'Chưa ghi nhận';
  const age = now - Date.parse(date);
  if (age < -60_000) return shortAccountDate(date);
  if (age < 60_000) return 'Vừa xong';
  if (age < 3600_000) return `${Math.floor(age / 60_000)} phút trước`;
  if (age < 86400_000) return `${Math.floor(age / 3600_000)} giờ trước`;
  if (age < 7 * 86400_000) return `${Math.floor(age / 86400_000)} ngày trước`;
  return shortAccountDate(date);
}
