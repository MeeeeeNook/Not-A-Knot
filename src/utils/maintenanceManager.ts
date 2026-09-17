import { MaintenanceConfig } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  enabled: false,
  title: 'Website Đang Tạm Đóng Để Bảo Trì',
  message:
    'Website đang tạm dừng hoạt động để bảo trì kỹ thuật. Quý khách vui lòng ghé thăm Fanpage Facebook hoặc liên hệ hotline để được hỗ trợ đặt hàng nhanh nhất!',
  estimatedEndTime: '',
  showButton: true,
  buttonText: 'Ghé Thăm Fanpage Facebook',
  buttonUrl: 'https://www.facebook.com/profile.php?id=61593591390851',
  showImage: false,
  imageBase64: '',
  imageAlt: 'Thông báo bảo trì hệ thống NOT A KNOT',
  imageUrlTarget: 'https://www.facebook.com/profile.php?id=61593591390851',
  autoRedirect: false,
  autoRedirectSeconds: 5,
  autoRedirectUrl: 'https://www.facebook.com/profile.php?id=61593591390851',
  emergencyContactText: 'Cần hỗ trợ đơn hàng gấp? Liên hệ qua Hotline / Zalo:',
  emergencyContactPhone: '0342 938 174',
  emergencyContactZalo: '0342938174'
};

const STORAGE_KEY = 'nak_maintenance_config';
const EVENT_NAME = 'nak_maintenance_update';

/**
 * Synchronously retrieves initial maintenance config from LocalStorage.
 * Zero-network delay, 100% resilient to Firebase downtime.
 */
export function getInitialMaintenanceConfig(): MaintenanceConfig {
  if (typeof window === 'undefined') return DEFAULT_MAINTENANCE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          ...DEFAULT_MAINTENANCE_CONFIG,
          ...parsed
        };
      }
    }
  } catch (err) {
    console.warn('Lỗi đọc cấu hình bảo trì từ LocalStorage:', err);
  }
  return DEFAULT_MAINTENANCE_CONFIG;
}

/**
 * Compress an uploaded image file into a compact Base64 Data URL.
 * 100% Client-side using HTML5 Canvas — completely avoids Firebase Storage.
 */
export async function compressImageFileToBase64(
  file: File,
  maxWidth = 1200,
  maxHeight = 900,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể tải dữ liệu ảnh'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to raw result if canvas context fails
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try webp or jpeg for high compression
        let base64 = canvas.toDataURL('image/webp', quality);
        if (!base64.startsWith('data:image/webp')) {
          base64 = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(base64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Saves maintenance configuration:
 * 1. Synchronously writes to localStorage for instant local access.
 * 2. Emits window event for all active views.
 * 3. Persists to Firestore document with safe try/catch error shielding.
 */
export async function saveMaintenanceConfig(
  config: MaintenanceConfig,
  updatedBy?: string
): Promise<{ success: boolean; cloudSynced: boolean; error?: string }> {
  const payload: MaintenanceConfig = {
    ...DEFAULT_MAINTENANCE_CONFIG,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || config.updatedBy || 'Quản trị viên'
  };

  // 1. LocalStorage update (Guaranteed to succeed, zero network risk)
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
    }
  } catch (localErr) {
    console.warn('Lỗi ghi LocalStorage bảo trì:', localErr);
  }

  // 2. Firestore Cloud persistence (safe try/catch)
  let cloudSynced = false;
  let cloudError: string | undefined;

  try {
    if (db) {
      const docRef = doc(db, 'site_content', 'maintenance_config');
      await setDoc(docRef, payload, { merge: true });

      // Also merge into main site_content document as a backup replica
      try {
        const mainContentRef = doc(db, 'site_content', 'main_config');
        await setDoc(mainContentRef, { maintenanceConfig: payload }, { merge: true });
      } catch (backupErr) {
        console.warn('Không thể ghi bản sao dự phòng bảo trì vào main_config:', backupErr);
      }

      cloudSynced = true;
    }
  } catch (err: any) {
    console.error('Lỗi đồng bộ cấu hình bảo trì lên Firestore Cloud:', err);
    cloudError = err?.message || 'Không thể kết nối Firestore';
  }

  return {
    success: true,
    cloudSynced,
    error: cloudError
  };
}

/**
 * Subscribes to real-time maintenance configuration changes:
 * - Real-time Firestore onSnapshot for multi-device sync
 * - Local window events and storage events for zero-latency local updates
 */
export function subscribeToMaintenanceConfig(
  onChange: (config: MaintenanceConfig) => void
): () => void {
  // Trigger initial from localStorage
  const initial = getInitialMaintenanceConfig();
  onChange(initial);

  // Local window event listener
  const handleLocalEvent = (e: Event) => {
    const custom = e as CustomEvent<MaintenanceConfig>;
    if (custom.detail) {
      onChange(custom.detail);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        onChange({ ...DEFAULT_MAINTENANCE_CONFIG, ...parsed });
      } catch (err) {
        // ignore
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(EVENT_NAME, handleLocalEvent);
    window.addEventListener('storage', handleStorageEvent);
  }

  // Firestore onSnapshot listener
  let unsubFirestore: (() => void) | null = null;
  try {
    if (db) {
      const docRef = doc(db, 'site_content', 'maintenance_config');
      unsubFirestore = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as MaintenanceConfig;
            const merged = { ...DEFAULT_MAINTENANCE_CONFIG, ...data };
            // Cache to local
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
              }
            } catch (ignore) {}
            onChange(merged);
          }
        },
        (err) => {
          console.warn('Lỗi lắng nghe Firestore maintenance_config:', err);
        }
      );
    }
  } catch (err) {
    console.warn('Không thể khởi tạo snapshot Firestore cho bảo trì:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener(EVENT_NAME, handleLocalEvent);
      window.removeEventListener('storage', handleStorageEvent);
    }
    if (unsubFirestore) {
      unsubFirestore();
    }
  };
}

/**
 * Generates a completely standalone single-file `maintenance.html` document.
 * Contains inline CSS, inline Base64 image, and automatic redirect script.
 * The user can download this file and host it on GitHub Pages, Vercel, Netlify,
 * or their own server without any external dependencies or Firebase!
 */
export function generateStandaloneMaintenanceHtml(config: MaintenanceConfig): string {
  const title = config.title || 'Website Đang Tạm Đóng Để Bảo Trì';
  const message = config.message || 'Website đang tạm dừng hoạt động để bảo trì kỹ thuật. Quý khách vui lòng ghé thăm Fanpage hoặc liên hệ hotline để được hỗ trợ nhanh nhất!';
  const buttonHtml = config.showButton && config.buttonUrl
    ? `<a href="${config.buttonUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary">${config.buttonText || 'Ghé Thăm Fanpage Facebook'} &rarr;</a>`
    : '';
  const imageHtml = config.showImage && config.imageBase64
    ? `<div class="image-wrapper">
         ${config.imageUrlTarget ? `<a href="${config.imageUrlTarget}" target="_blank" rel="noopener noreferrer">` : ''}
           <img src="${config.imageBase64}" alt="${config.imageAlt || 'Maintenance'}" class="banner-img" />
         ${config.imageUrlTarget ? `</a>` : ''}
       </div>`
    : '';
  const autoRedirectScript = config.autoRedirect && config.autoRedirectUrl && (config.autoRedirectSeconds || 0) > 0
    ? `
    let remaining = ${config.autoRedirectSeconds};
    const timerElem = document.getElementById('countdown-timer');
    const interval = setInterval(() => {
      remaining--;
      if (timerElem) timerElem.innerText = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        window.location.href = "${config.autoRedirectUrl}";
      }
    }, 1000);
    `
    : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | NOT A KNOT</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #FAF9F6;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 32px 24px;
      line-height: 1.6;
    }
    .header {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #0f172a;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .main-container {
      max-width: 1100px;
      width: 100%;
      margin: 40px auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: center;
    }
    @media (max-width: 860px) {
      .main-container {
        grid-template-columns: 1fr;
        text-align: center;
      }
    }
    .title {
      font-size: 38px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 18px;
    }
    .message {
      font-size: 16px;
      color: #475569;
      line-height: 1.7;
      margin-bottom: 28px;
      white-space: pre-line;
    }
    .banner-img {
      max-width: 100%;
      height: auto;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #fbbf24;
      color: #0f172a;
      font-weight: 900;
      font-size: 15px;
      padding: 16px 32px;
      border-radius: 16px;
      text-decoration: none;
      box-shadow: 0 10px 20px -5px rgba(245, 158, 11, 0.35);
      transition: all 0.2s ease;
    }
    .btn-primary:hover {
      background: #f59e0b;
      transform: translateY(-2px);
    }
    .contacts {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      color: #64748b;
    }
    .contacts a {
      display: inline-block;
      margin-top: 6px;
      margin-right: 12px;
      padding: 6px 14px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      color: #0f172a;
      font-weight: 700;
      text-decoration: none;
    }
    .footer {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">
      <div class="brand-title">NOT A KNOT</div>
    </div>
  </header>

  <main class="main-container">
    <div class="left-col">
      ${imageHtml || `<svg viewBox="0 0 520 420" fill="none" style="width:100%;max-width:480px;"><rect x="108" y="120" width="344" height="195" rx="14" fill="#1E293B"/><rect x="118" y="130" width="324" height="175" rx="8" fill="#F0F9FF"/><g transform="translate(100, 185) rotate(-1)"><rect x="0" y="0" width="360" height="40" rx="4" fill="#FACC15"/></g><path d="M 68 348 L 452 348 C 458 348 463 344 461 338 L 444 286 L 76 286 L 59 338 Z" fill="#E2E8F0"/><circle cx="440" cy="115" r="22" fill="#F97316"/><circle cx="50" cy="275" r="20" fill="#EAB308"/></svg>`}
    </div>
    <div class="right-col">
      <h1 class="title">${title}</h1>
      <p class="message">${message}</p>
      ${buttonHtml}
      ${
        config.emergencyContactPhone || config.emergencyContactZalo
          ? `<div class="contacts">
               <p><strong>${config.emergencyContactText || 'Cần hỗ trợ đơn hàng gấp:'}</strong></p>
               <div style="margin-top: 8px;">
                 ${config.emergencyContactPhone ? `<a href="tel:${config.emergencyContactPhone.replace(/\s+/g, '')}">📞 Hotline: ${config.emergencyContactPhone}</a>` : ''}
                 ${config.emergencyContactZalo ? `<a href="https://zalo.me/${config.emergencyContactZalo.replace(/\s+/g, '')}" target="_blank">💬 Zalo: ${config.emergencyContactZalo}</a>` : ''}
               </div>
             </div>`
          : ''
      }
    </div>
  </main>

  <footer class="footer">
    © ${new Date().getFullYear()} NOT A KNOT. Tất cả quyền được bảo lưu.
  </footer>
  ${autoRedirectScript ? `<script>${autoRedirectScript}</script>` : ''}
</body>
</html>`;
}
