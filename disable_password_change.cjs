const fs = require('fs');
let content = fs.readFileSync('src/components/AdminSellersManager.tsx', 'utf8');

content = content.replace(
  /onClick=\{\(\) => \{\s*if \(isChangingPassword\) \{\s*setPasswordTargetSellerId\(null\);\s*\} else \{\s*handleStartPasswordChange\(seller\);\s*\}\s*\}\}/g,
  `onClick={() => { alert('Tính năng đổi mật khẩu trên ứng dụng đã bị vô hiệu hóa vì lý do bảo mật. Vui lòng đổi mật khẩu trong Firebase Console (Authentication).'); }}`
);

fs.writeFileSync('src/components/AdminSellersManager.tsx', content);
