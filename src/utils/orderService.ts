import { StoredOrder } from '../firebase';
import { auth, dispatchSafeEvent } from '../firebase';

export interface CreateOrderResult {
  success: boolean;
  order?: StoredOrder;
  requiresConfirmation?: boolean;
  priceChanged?: boolean;
  oldTotal?: number;
  newTotal?: number;
  calculation?: {
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    total: number;
  };
  error?: string;
  isDuplicate?: boolean;
}

const getBackendUrl = (): string => {
  const meta = import.meta as any;
  const customUrl = meta && meta.env ? meta.env.VITE_BACKEND_URL : undefined;
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'notaknot.id.vn') {
    return 'https://www.notaknot.id.vn';
  }
  return '';
};

export async function submitOrderToServer(
  orderPayload: any,
  options: {
    expectedTotal?: number;
    confirmedPrice?: number;
  } = {}
): Promise<CreateOrderResult> {
  const baseUrl = getBackendUrl();
  const endpoint = `${baseUrl}/api/orders/create`;

  // Check if current user is an authenticated Firebase user (staff member)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };

  try {
    if (auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
    }
  } catch {
    // ignore token fetch error for anonymous customers
  }

  const payload = {
    ...orderPayload,
    expectedTotal: options.expectedTotal !== undefined ? options.expectedTotal : orderPayload.totalPrice,
    confirmedPrice: options.confirmedPrice
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  let data: any;

  try {
    data = JSON.parse(rawText);
  } catch {
    if (response.status === 429) {
      return {
        success: false,
        error: 'Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng chờ 10 phút rồi thử lại.'
      };
    }
    return {
      success: false,
      error: `Máy chủ phản hồi không đúng định dạng (${response.status}). Vui lòng thử lại.`
    };
  }

  // Handle price drift confirmation (HTTP 409)
  if (response.status === 409 || data.requiresConfirmation) {
    return {
      success: false,
      requiresConfirmation: true,
      priceChanged: true,
      oldTotal: data.oldTotal,
      newTotal: data.newTotal,
      calculation: data.calculation,
      error: data.message || 'Giá sản phẩm hoặc khuyến mãi có sự thay đổi. Vui lòng xác nhận lại.'
    };
  }

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || data.message || `Lỗi đặt hàng (${response.status}).`
    };
  }

  // Successfully confirmed order from server
  const confirmedOrder: StoredOrder = data.order;

  // Synchronize local storage cache for offline / instant view
  try {
    const existingStr = localStorage.getItem('nak_preorders');
    const existingList: StoredOrder[] = existingStr ? JSON.parse(existingStr) : [];
    const normKey = (confirmedOrder.id || '').toUpperCase();
    const updatedList = [
      confirmedOrder,
      ...existingList.filter((o) => {
        const k1 = (o.id || '').toUpperCase();
        const k2 = (o.trackingNumber || '').toUpperCase();
        return k1 !== normKey && k2 !== normKey;
      })
    ];
    localStorage.setItem('nak_preorders', JSON.stringify(updatedList));
    localStorage.setItem('nak_last_order_code', confirmedOrder.id);
  } catch {
    // ignore storage quota errors
  }

  // Broadcast custom event
  dispatchSafeEvent('nak_order_created', confirmedOrder);

  return {
    success: true,
    order: confirmedOrder,
    isDuplicate: data.isDuplicate
  };
}
