import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Educational Project Console Notice
console.log(
  '%c[NOT A KNOT]%c\nNot A Knot cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập và bài tập nhóm thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử - Đại học Kinh tế Quốc dân. Dự án được triển khai hoàn toàn nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.',
  'color: #d97706; font-size: 16px; font-weight: 800;',
  'color: #475569; font-size: 13px; line-height: 1.6; font-weight: 500;'
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
