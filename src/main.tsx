import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Safe modal alert fallback for sandboxed iFrames
if (typeof window !== 'undefined') {
  const originalAlert = window.alert;
  window.alert = function (msg?: any) {
    try {
      if (typeof originalAlert === 'function') {
        originalAlert.call(window, msg);
        return;
      }
    } catch {}
    console.warn('[Modal Notice]:', msg);
  };

  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const msg = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      msg.includes('Disconnecting idle stream') ||
      msg.includes('Timed out waiting for new targets') ||
      msg.includes("RPC 'Listen' stream") ||
      msg.includes('GrpcConnection RPC')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

// Educational Project Console Notice
console.log(
  '%c[NOT A KNOT]%c\nNot A Knot cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập và bài tập nhóm thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử - Đại học Kinh tế Quốc dân. Dự án được triển khai hoàn toàn nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.',
  'color: #d97706; font-size: 16px; font-weight: 800;',
  'color: #475569; font-size: 13px; line-height: 1.6; font-weight: 500;'
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
