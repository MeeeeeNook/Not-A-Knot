import type { AffiliateSystemConfig, ProductCommissionOverride, RevenueTierCommission, SellerUser } from '../types';

export interface AffiliatePartnerDraft {
  name: string;
  email: string;
  code: string;
  rate: string;
  phone: string;
  paymentInfo: string;
  isActive: boolean;
  cookieDays: string;
  maxOrdersMode: 'first_only' | 'custom' | 'unlimited';
  maxOrders: string;
  model: 'standard' | 'by_product' | 'tiered';
  productRates: ProductCommissionOverride[];
  tiers: RevenueTierCommission[];
}

export function createAffiliatePartnerDraft(affiliate: SellerUser | null, config: AffiliateSystemConfig, suggestedCode: string): AffiliatePartnerDraft {
  const maxOrders = affiliate?.maxOrdersPerCookieSession ?? 1;
  return {
    name: affiliate?.name || '', email: affiliate?.googleEmail || affiliate?.email || '',
    code: affiliate?.affiliateCode || affiliate?.username?.toUpperCase() || suggestedCode,
    rate: String(affiliate?.commissionRate ?? config.defaultCommissionRate),
    phone: affiliate?.phone || '', paymentInfo: affiliate?.paymentInfo || '', isActive: affiliate?.isActive !== false,
    cookieDays: affiliate?.cookieDurationDays ? String(affiliate.cookieDurationDays) : '',
    maxOrdersMode: maxOrders === 0 ? 'unlimited' : maxOrders > 1 ? 'custom' : 'first_only',
    maxOrders: String(maxOrders > 1 ? maxOrders : 3), model: affiliate?.commissionModel || 'standard',
    productRates: (affiliate?.productCommissions || []).map((p) => ({ ...p })),
    tiers: (affiliate?.tieredCommissions || []).map((t) => ({ ...t }))
  };
}

export const isValidCommissionRate = (value: string | number) =>
  String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;

export function validateCommissionTiers(tiers: RevenueTierCommission[]): string | null {
  if (!tiers.length) return 'Thêm ít nhất một bậc hoa hồng hoặc chọn cơ chế cố định.';
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);
  let expectedMin = 0;
  for (let i = 0; i < sorted.length; i++) {
    const tier = sorted[i];
    if (!Number.isSafeInteger(tier.minAmount) || tier.minAmount < 0 || !isValidCommissionRate(tier.rate)) return 'Mức tiền phải là số nguyên không âm; tỷ lệ hoa hồng từ 0 đến 100%.';
    if (tier.minAmount !== expectedMin) return 'Các bậc phải bắt đầu từ 0đ và liền nhau, không có khoảng trống hoặc chồng lấn.';
    const hasMax = tier.maxAmount !== undefined && tier.maxAmount !== 0;
    if (hasMax && (!Number.isSafeInteger(tier.maxAmount) || tier.maxAmount <= tier.minAmount)) return 'Mức đến phải lớn hơn mức từ.';
    if (!hasMax && i !== sorted.length - 1) return 'Bậc không giới hạn phải nằm cuối cùng.';
    if (hasMax && i === sorted.length - 1) return 'Để trống mức đến của bậc cuối để bao phủ mọi giá trị đơn.';
    expectedMin = tier.maxAmount || 0;
  }
  return null;
}

export function validateAffiliatePartnerStep(draft: AffiliatePartnerDraft, step: number, sellers: SellerUser[], editing: SellerUser | null): string | null {
  if (step === 0) {
    const email = draft.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Nhập email Google hợp lệ để đối tác đăng nhập.';
    if (!draft.name.trim()) return 'Nhập tên hiển thị của đối tác.';
    if (editing?.googleEmail && email !== editing.googleEmail.trim().toLowerCase()) return 'Email đã cấp quyền đăng nhập không thể đổi trong form này.';
    if (sellers.some((s) => s.id !== editing?.id && [s.googleEmail, s.email].some((value) => value?.trim().toLowerCase() === email))) return 'Email này đã được dùng cho một tài khoản khác.';
  }
  if (step === 1) {
    const code = draft.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return 'Mã tiếp thị cần 2–40 ký tự: chữ, số, dấu gạch ngang hoặc gạch dưới.';
    if (sellers.some((s) => s.id !== editing?.id && (s.affiliateCode || (s.role === 'affiliate' ? s.username : '')).trim().toUpperCase() === code)) return 'Mã tiếp thị đã được sử dụng. Hãy chọn mã khác.';
  }
  if (step === 2) {
    if (draft.cookieDays.trim() && (!Number.isInteger(Number(draft.cookieDays)) || Number(draft.cookieDays) < 1 || Number(draft.cookieDays) > 365)) return 'Thời hạn cookie phải là số nguyên từ 1 đến 365 ngày.';
    if (draft.maxOrdersMode === 'custom' && (!Number.isInteger(Number(draft.maxOrders)) || Number(draft.maxOrders) < 2 || Number(draft.maxOrders) > 100)) return 'Số đơn cụ thể phải là số nguyên từ 2 đến 100.';
  }
  if (step === 3) {
    if (!isValidCommissionRate(draft.rate)) return 'Nhập tỷ lệ cơ bản từ 0 đến 100% (0% vẫn hợp lệ).';
    if (draft.model === 'by_product' && draft.productRates.some((p) => !p.productId || !isValidCommissionRate(p.rate))) return 'Kiểm tra lại tỷ lệ riêng của sản phẩm: từ 0 đến 100%.';
    if (draft.model === 'tiered') return validateCommissionTiers(draft.tiers);
  }
  return null;
}

export function buildAffiliatePartner(draft: AffiliatePartnerDraft, editing: SellerUser | null, sellers: SellerUser[]): SellerUser {
  const code = draft.code.trim().toUpperCase();
  let username = editing?.username || `aff_${code.toLowerCase()}`;
  if (!editing) {
    const baseUsername = username;
    let suffix = 1;
    while (sellers.some((s) => s.username?.toLowerCase() === username)) username = `${baseUsername}_${suffix++}`;
  }
  const now = new Date().toISOString();
  return {
    ...editing,
    id: editing?.id || `affiliate-${crypto.randomUUID()}`,
    username, name: draft.name.trim(), googleEmail: draft.email.trim().toLowerCase(),
    role: 'affiliate', isActive: draft.isActive, affiliateCode: code, commissionRate: Number(draft.rate),
    cookieDurationDays: draft.cookieDays.trim() ? Number(draft.cookieDays) : undefined,
    maxOrdersPerCookieSession: draft.maxOrdersMode === 'unlimited' ? 0 : draft.maxOrdersMode === 'custom' ? Number(draft.maxOrders) : 1,
    commissionModel: draft.model,
    productCommissions: draft.model === 'by_product' ? draft.productRates.map((p) => ({ ...p })) : [],
    tieredCommissions: draft.model === 'tiered' ? [...draft.tiers].sort((a, b) => a.minAmount - b.minAmount) : [],
    phone: draft.phone.trim(), paymentInfo: draft.paymentInfo.trim(),
    avatarColor: editing?.avatarColor || '#991B1B', createdAt: editing ? editing.createdAt : now
  };
}
