import nodemailer from 'nodemailer';

function ensureGmailDomain(input: any): string {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (!trimmed.includes('@')) return `${trimmed}@gmail.com`;
  if (trimmed.endsWith('@')) return `${trimmed}gmail.com`;
  return trimmed;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { targetEmail } = req.body || {};
    const destination = ensureGmailDomain(targetEmail || 'noreply.notaknot@gmail.com');

    if (!destination) {
      return res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    }

    const SMTP_USER = process.env.SMTP_USER || 'noreply.notaknot@gmail.com';
    const SMTP_PASS = process.env.SMTP_PASS || 'nioymdoezmrflsmr';

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: `"NOT A KNOT" <${SMTP_USER}>`,
      to: destination,
      subject: '[NOT A KNOT] Thử nghiệm kết nối hệ thống Email thành công!',
      html: `
        <div style="font-family:sans-serif;padding:24px;max-width:500px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
          <h2 style="color:#0f172a;margin-top:0;font-size:18px;">NOT A KNOT Handmade Studio</h2>
          <p style="font-size:13px;color:#334155;">Hệ thống gửi thư tự động (SMTP) của website NOT A KNOT đã được kết nối thành công và sẵn sàng gửi thư!</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;" />
          <p style="font-size:11px;color:#94a3b8;">Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN')}</p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      destination,
      message: `Đã gửi thành công email thử nghiệm đến ${destination}!`
    });
  } catch (err: any) {
    console.error('[Vercel Test Email Error]:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi gửi email thử nghiệm qua SMTP.'
    });
  }
}
