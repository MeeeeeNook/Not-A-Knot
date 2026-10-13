import { getAuthoritativeAffiliate, getAuthoritativeAffiliateConfig } from './orders/create.ts';

// Public referral lookup: deliberately excludes emails, credentials and payment details.
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Phương thức không được hỗ trợ.' });
  const code = typeof req.query?.code === 'string' ? req.query.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return res.status(400).json({ error: 'Mã affiliate không hợp lệ.' });
  let timer: ReturnType<typeof setTimeout>;
  try {
    const read = async () => {
      const affiliate = await getAuthoritativeAffiliate(code);
      const config = affiliate && !affiliate.cookieDurationDays ? await getAuthoritativeAffiliateConfig() : null;
      return { affiliate, config };
    };
    const { affiliate, config } = await Promise.race([read(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 3500); })]);
    if (!affiliate || affiliate.isActive === false) return res.status(404).json({ affiliate: null });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ affiliate: {
      id: affiliate.id, username: affiliate.username, name: affiliate.name,
      role: 'affiliate', isActive: true, affiliateCode: affiliate.affiliateCode || code,
      commissionRate: affiliate.commissionRate, commissionModel: affiliate.commissionModel,
      productCommissions: affiliate.productCommissions || [], tieredCommissions: affiliate.tieredCommissions || [],
      cookieDurationDays: affiliate.cookieDurationDays || config?.cookieDurationDays || 30,
      maxOrdersPerCookieSession: affiliate.maxOrdersPerCookieSession ?? 1
    } });
  } catch { return res.status(503).json({ error: 'Chưa thể xác minh link affiliate. Vui lòng thử lại.' }); }
  finally { clearTimeout(timer!); }
}
