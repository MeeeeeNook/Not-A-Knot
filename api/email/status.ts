export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    configured: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    configuredUser: 'no***@gmail.com',
    maskedPass: '••••••••••••••••',
    hasCustomPass: true,
    adminNotificationEmail: 'noreply.notaknot@gmail.com',
    settings: {
      notifyAdminOnNewOrder: false,
      customerOrderEmailOption: true,
      adminNotificationEmail: 'noreply.notaknot@gmail.com',
      hasCustomPass: true
    },
    stats: {
      today: 1,
      thisWeek: 1,
      thisMonth: 1,
      total: 1,
      dailyLimit: 500
    },
    mode: 'live_smtp'
  });
}
