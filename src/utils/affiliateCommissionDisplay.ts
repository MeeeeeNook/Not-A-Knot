import type { SellerUser } from '../types';

// Presentation only: do not change the commission calculation or saved orders.
export function getAffiliateCommissionDisplay(affiliate: SellerUser | null, defaultRate: number) {
  const rate = affiliate?.commissionRate ?? defaultRate;
  if (affiliate?.commissionModel === 'tiered') {
    const rates = (affiliate.tieredCommissions || []).map((tier) => tier.rate).filter((value) => Number.isFinite(value) && value >= 0);
    const min = Math.min(...rates), max = Math.max(...rates);
    return {
      label: 'Hoa hồng theo bậc',
      value: rates.length === 0 ? 'Chưa cấu hình bậc' : min === max ? `${min}% theo bậc` : `${min}% – ${max}% theo bậc`,
      description: 'hoa hồng theo bậc giá trị từng đơn',
      tooltip: 'Áp dụng tỷ lệ của bậc tương ứng với giá trị sản phẩm sau giảm giá của từng đơn. Xem bảng bậc trong Hướng dẫn.'
    };
  }
  if (affiliate?.commissionModel === 'by_product') {
    return {
      label: 'Tỷ lệ mặc định', value: `${rate}%`, description: 'hoa hồng theo từng sản phẩm',
      tooltip: 'Sản phẩm có tỷ lệ riêng dùng tỷ lệ đã cấu hình; sản phẩm còn lại dùng tỷ lệ mặc định này.'
    };
  }
  return {
    label: 'Tỷ lệ cố định', value: `${rate}%`, description: `hoa hồng cố định ${rate}%`,
    tooltip: 'Tỷ lệ áp dụng trên giá trị sản phẩm sau giảm giá, không tính phí vận chuyển.'
  };
}
