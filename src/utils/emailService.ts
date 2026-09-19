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

    const primaryBaseUrl = getBackendUrl();
    let res = await fetch(`${primaryBaseUrl}/api/email/send-order-confirmation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...order,
        products: Array.isArray(prods) ? prods : []
      })
    });

    let data = await safeJsonParse(res);

    // If Vercel or local static server returned HTML 404, automatically fallback to Cloud Run live backend
    if ((!res.ok || data.isHtmlError) && !primaryBaseUrl) {
      console.warn('[Email Service Client] Vercel returned HTML 404, falling back to live Cloud Run backend...');
      try {
        const fallbackRes = await fetch(`${FALLBACK_BACKEND_URL}/api/email/send-order-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...order, products: Array.isArray(prods) ? prods : [] })
        });
        const fallbackData = await safeJsonParse(fallbackRes);
        if (fallbackRes.ok && fallbackData.success) {
          return fallbackData;
        }
      } catch (fbErr) {
        console.warn('[Email Service Client] Fallback backend request error:', fbErr);
      }
    }

    if (!res.ok || data.isHtmlError) {
      return {
        success: false,
        error: data.error || data.message || `Lỗi máy chủ (${res.status})`
      };
    }

    return data;
  } catch (err: any) {
    try {
      let prods = products || [];
      const fallbackRes = await fetch(`${FALLBACK_BACKEND_URL}/api/email/send-order-confirmation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...order, products: prods })
      });
      const fallbackData = await safeJsonParse(fallbackRes);
      if (fallbackRes.ok && fallbackData.success) {
        return fallbackData;
      }
    } catch {
      // ignore
    }

    console.warn('[Email Service Client] Dispatch warning:', err);
    return {
      success: false,
      error: err.message || 'Lỗi mạng khi kích hoạt gửi email.'
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
    let res = await fetch(`${primaryBaseUrl}/api/email/test-delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetEmail })
    });

    let data = await safeJsonParse(res);

    if ((!res.ok || data.isHtmlError) && !primaryBaseUrl) {
      try {
        const fallbackRes = await fetch(`${FALLBACK_BACKEND_URL}/api/email/test-delivery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetEmail })
        });
        const fallbackData = await safeJsonParse(fallbackRes);
        if (fallbackRes.ok && fallbackData.success) {
          return {
            success: true,
            message: fallbackData.message || 'Đã gửi email test thành công!',
            configured: fallbackData.configured
          };
        }
      } catch {
        // ignore
      }
    }

    return {
      success: Boolean(data.success),
      message: data.message || data.error || 'Thực hiện kiểm tra hoàn tất.',
      configured: data.configured
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Không thể kết nối đến máy chủ để gửi email test.'
    };
  }
}
