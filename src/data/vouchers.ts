import type { Voucher } from '../types.js';

export const DEFAULT_INITIAL_VOUCHERS: Omit<Voucher, 'encryptedData'>[] = [
  {
    id: 'voucher-huytran',
    code: 'HUYTRAN',
    type: 'percent',
    discountPercent: 10,
    minOrderValue: 50000,
    maxDiscountAmount: 30000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdBy: 'Trần Việt Huy',
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'voucher-knot10',
    code: 'KNOT10',
    type: 'percent',
    discountPercent: 10,
    minOrderValue: 100000,
    maxDiscountAmount: 50000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'voucher-freeship',
    code: 'FREESHIP',
    type: 'freeship',
    discountPercent: 0,
    minOrderValue: 150000,
    maxDiscountAmount: 30000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'voucher-naknew',
    code: 'NAKNEW',
    type: 'percent',
    discountPercent: 15,
    minOrderValue: 80000,
    maxDiscountAmount: 40000,
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];
