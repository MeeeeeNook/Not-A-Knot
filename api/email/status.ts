export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasUser = Boolean(process.env.SMTP_USER);
  const hasPass = Boolean(process.env.SMTP_PASS && process.env.SMTP_PASS.trim());
  const isConfigured = hasUser && hasPass;
  const user = (process.env.SMTP_USER || '').trim();
  const configuredUser = user ? user.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'Chưa cấu hình';
  const adminNotificationEmail = (process.env.ADMIN_NOTIFICATION_EMAIL || user || 'noreply.notaknot@gmail.com').trim();

  return res.status(200).json({
    configured: isConfigured,
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: Number(process.env.SMTP_PORT) || 465,
    smtpSecure: process.env.SMTP_SECURE !== 'false',
    configuredUser,
    hasCustomPass: hasPass,
    adminNotificationEmail,
    settings: {
      notifyAdminOnNewOrder: false,
      customerOrderEmailOption: true,
      adminNotificationEmail,
      hasCustomPass: hasPass
    },
    mode: isConfigured ? 'live_smtp' : 'simulated_preview'
  });
}
