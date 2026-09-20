import { StoredOrder } from '../firebase';

/**
 * Ensures an email address has a valid domain.
 * If there is no domain or no @ sign (e.g. "abc" or "abc@"), automatically appends "@gmail.com".
 * If an @ symbol with a domain already exists (e.g. "abc@gmail.com" or "abc@yahoo.com"), leaves it as is.
 */
export function ensureGmailDomain(email: string): string {
  if (!email) return '';
  const trimmed = email.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('@')) {
    return `${trimmed}@gmail.com`;
  }
  if (trimmed.endsWith('@')) {
    return `${trimmed}gmail.com`;
  }
  return trimmed;
}

export interface EmailDeliveryResult {
  success: boolean;
  mode?: 'sent_real_email' | 'simulated_preview';
  message?: string;
  error?: string;
  orderCode?: string;
  recipients?: string[];
  timestamp?: string;
}

export interface EmailConfigStatus {
  configured: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  configuredUser: string;
  adminNotificationEmail: string;
  mode: 'live_smtp' | 'simulated_preview';
}

const FALLBACK_BACKEND_URL = 'https://ais-dev-7sezls5lyoi5ncet3scdnq-757868820902.asia-southeast1.run.app';

async function safeJsonParse(res: Response) {
  try {
    const text = await res.text();
    const trimmed = text ? text.trim() : '';
    if (!trimmed || trimmed.startsWith('<') || trimmed.startsWith('The page') || trimmed.startsWith('Not Found') || trimmed.startsWith('<!DOCTYPE')) {
      return {
        success: false,
        isHtmlError: true,
        error: `Máy chủ Vercel chưa xử lý được endpoint (${res.status})`,
        message: `Máy chủ Vercel chưa xử lý được endpoint (${res.status})`
      };
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      if (trimmed.includes('FUNCTION_INVOCATION_FAILED')) {
        return {
          success: false,
          isHtmlError: true,
          error: 'Hàm Vercel Serverless gặp lỗi (FUNCTION_INVOCATION_FAILED). Cần triển khai phiên bản api/email mới lên Vercel.',
          message: 'Hàm Vercel Serverless gặp lỗi (FUNCTION_INVOCATION_FAILED). Cần triển khai phiên bản api/email mới lên Vercel.'
        };
      }
      return {
        success: false,
        isHtmlError: true,
        error: trimmed.length < 150 ? trimmed : `Máy chủ phản hồi không đúng định dạng (${res.status})`,
        message: trimmed.length < 150 ? trimmed : `Máy chủ phản hồi không đúng định dạng (${res.status})`
      };
    }
  } catch {
    return {
      success: false,
      isHtmlError: true,
      error: `Lỗi kết nối máy chủ (${res.status})`,
      message: `Lỗi kết nối máy chủ (${res.status})`
    };
  }
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

/**
 * Triggers asynchronous order confirmation email dispatch on the server.
 * Never throws exceptions, ensuring checkout flows continue unhindered.
 */
export async function sendOrderConfirmationEmail(order: any, products?: any[]): Promise<EmailDeliveryResult> {
  try {
    let prods = products;
    if (!prods || !Array.isArray(prods) || prods.length === 0) {
      try {
        const saved = localStorage.getItem('nak_custom_products');
        if (saved) prods = JSON.parse(saved);
      } catch {
        // ignore
      }
    }

    const targetRecipient = order.email || order.customerEmail || (order as any).recipientEmail || (order as any).targetEmail;
    const cleanRecipient = targetRecipient ? ensureGmailDomain(targetRecipient) : '';

    const payload = {
      ...order,
      orderData: order,
      recipientEmail: cleanRecipient,
      targetEmail: cleanRecipient,
      email: cleanRecipient,
      customerEmail: cleanRecipient,
      products: Array.isArray(prods)
        ? prods.slice(0, 100).map((p: any) => ({
            id: p.id,
            name: p.name,
            image: typeof p.image === 'string' && !p.image.startsWith('data:') ? p.image : undefined,
            img: typeof p.img === 'string' && !p.img.startsWith('data:') ? p.img : undefined,
            colorOptions: Array.isArray(p.colorOptions)
              ? p.colorOptions.map((c: any) => ({
                  name: c.name,
                  image: typeof c.image === 'string' && !c.image.startsWith('data:') ? c.image : undefined,
                  img: typeof c.img === 'string' && !c.img.startsWith('data:') ? c.img : undefined
                }))
              : undefined
          }))
        : []
    };

    const primaryBaseUrl = getBackendUrl();
    let res: Response | null = null;
    let data: any = null;

    try {
      res = await fetch(`${primaryBaseUrl}/api/email/send-order-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      data = await safeJsonParse(res);
    } catch {
      // Primary fetch failed completely
    }

    // If primary endpoint succeeded and returned valid JSON (not HTML error)
    if (res && data && !data.isHtmlError) {
      if (res.ok && data.success) {
        return data;
      }
      if (data.error || data.message) {
        return { success: false, error: data.error || data.message };
      }
    }

    // Fallback: If Vercel static host returned HTML or network error, call Cloud Run backend directly
    console.warn('[Email Service Client] Primary API unaccessible or returned static HTML, connecting to live backend...');
    try {
      const fallbackRes = await fetch(`${FALLBACK_BACKEND_URL}/api/email/send-order-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const fallbackData = await safeJsonParse(fallbackRes);
      if (!fallbackData.isHtmlError) {
        if (fallbackRes.ok && fallbackData.success) {
          return fallbackData;
        }
        return {
          success: false,
          error: fallbackData.error || fallbackData.message || 'Lỗi từ máy chủ khi gửi email.'
        };
      }
    } catch (fbErr) {
      console.warn('[Email Service Client] Fallback backend request error:', fbErr);
    }

    return {
      success: false,
      error: (data && data.error) || 'Không thể gửi email lúc này. Vui lòng kiểm tra lại cấu hình Vercel hoặc mạng.'
    };
  } catch (err: any) {
    console.warn('[Email Service Client] Dispatch error:', err);
    return {
      success: false,
      error: err.message || 'Lỗi mạng khi gửi yêu cầu email.'
    };
  }
}

/**
 * Fetches SMTP configuration status for the admin panel
 */
export async function fetchEmailConfigStatus(): Promise<EmailConfigStatus | null> {
  try {
    const baseUrl = getBackendUrl();
    const res = await fetch(`${baseUrl}/api/email/status`);
    if (!res.ok) return null;
    return await safeJsonParse(res);
  } catch (err) {
    console.warn('[Email Service Client] Status fetch error:', err);
    return null;
  }
}

/**
 * Tests delivery to a specific recipient or shop administrator
 */
export async function testEmailDelivery(targetEmail?: string): Promise<{ success: boolean; message: string; configured?: boolean }> {
  try {
    const primaryBaseUrl = getBackendUrl();
    let res: Response | null = null;
    let data: any = null;

    try {
      res = await fetch(`${primaryBaseUrl}/api/email/test-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail })
      });
      data = await safeJsonParse(res);
    } catch {
      // ignore
    }

    if (res && res.ok && data && !data.isHtmlError) {
      return {
        success: Boolean(data.success),
        message: data.message || data.error || 'Thực hiện kiểm tra hoàn tất.',
        configured: data.configured
      };
    }

    try {
      const fallbackRes = await fetch(`${FALLBACK_BACKEND_URL}/api/email/test-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail })
      });
      const fallbackData = await safeJsonParse(fallbackRes);
      if (!fallbackData.isHtmlError) {
        return {
          success: Boolean(fallbackData.success),
          message: fallbackData.message || fallbackData.error || 'Đã gửi email test thành công!',
          configured: fallbackData.configured
        };
      }
    } catch {
      // ignore
    }

    return {
      success: false,
      message: (data && (data.error || data.message)) || 'Không thể kết nối dịch vụ email lúc này.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Thao tác kiểm tra không thành công.'
    };
  }
}
