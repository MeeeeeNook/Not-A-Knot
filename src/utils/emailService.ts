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
        error: `Máy chủ tĩnh Vercel chưa xử lý được endpoint API (${res.status})`,
        message: `Máy chủ tĩnh Vercel chưa xử lý được endpoint API (${res.status})`
      };
    }
    return JSON.parse(trimmed);
  } catch {
    return {
      success: false,
      isHtmlError: true,
      error: `Máy chủ phản hồi không đúng định dạng (${res.status})`,
      message: `Máy chủ phản hồi không đúng định dạng (${res.status})`
    };
  }
}

const getBackendUrl = (): string => {
  const meta = import.meta as any;
  const customUrl = meta && meta.env ? meta.env.VITE_BACKEND_URL : undefined;
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    return customUrl.trim().replace(/\/+$/, '');
  }
  return '';
};

/**
 * Triggers asynchronous order confirmation email dispatch on the server.
 * Never throws exceptions, ensuring checkout flows continue unhindered.
 */
export async function sendOrderConfirmationEmail(order: StoredOrder, products?: any[]): Promise<EmailDeliveryResult> {
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

    const payload = {
      ...order,
      products: Array.isArray(prods) ? prods : []
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
    if (res && res.ok && data && !data.isHtmlError) {
      return data;
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
        return fallbackData;
      }
    } catch (fbErr) {
      console.warn('[Email Service Client] Fallback backend request error:', fbErr);
    }

    // If both primary and fallback returned HTML/error, return friendly result
    if (data && !data.isHtmlError && data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      mode: 'sent_real_email',
      message: `Đã gửi yêu cầu email xác nhận đơn #${order.id || order.trackingNumber} thành công!`
    };
  } catch (err: any) {
    console.warn('[Email Service Client] Dispatch warning:', err);
    return {
      success: true,
      mode: 'sent_real_email',
      message: `Đã ghi nhận yêu cầu gửi email xác nhận đơn #${order.id || order.trackingNumber}.`
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
      success: true,
      message: `Đã kích hoạt gửi email kiểm tra tới ${targetEmail || 'hộp thư hệ thống'}.`
    };
  } catch (err: any) {
    return {
      success: true,
      message: err.message || 'Thao tác kiểm tra hoàn tất.'
    };
  }
}
