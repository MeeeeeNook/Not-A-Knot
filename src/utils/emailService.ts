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

/**
 * Triggers asynchronous order confirmation email dispatch on the server.
 * Never throws exceptions, ensuring checkout flows continue unhindered.
 */
export async function sendOrderConfirmationEmail(order: StoredOrder): Promise<EmailDeliveryResult> {
  try {
    const res = await fetch('/api/email/send-order-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(order)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errJson.error || `Server status ${res.status}`
      };
    }

    const data = await res.json();
    return data;
  } catch (err: any) {
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
    const res = await fetch('/api/email/status');
    if (!res.ok) return null;
    return await res.json();
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
    const res = await fetch('/api/email/test-delivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ targetEmail })
    });

    const data = await res.json();
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
