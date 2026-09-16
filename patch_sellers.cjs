const fs = require('fs');
let content = fs.readFileSync('src/components/AdminSellersManager.tsx', 'utf8');

const importIdx = content.indexOf("import { JwtAdminPayload, ");
content = content.slice(0, importIdx) + "import { initializeApp, deleteApp } from 'firebase/app';\nimport { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';\n" + content.slice(importIdx);

const startIdx = content.indexOf("const newSeller: SellerUser = {");

const newLogic = `
      // Create Firebase Auth Account using a temporary secondary app to avoid logging out the admin
      try {
        const fbConfig = {
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        };
        const tempApp = initializeApp(fbConfig, 'TempApp-' + Date.now());
        const tempAuth = getAuth(tempApp);
        
        const email = \`\${cleanUsername}@notaknot.local\`;
        await createUserWithEmailAndPassword(tempAuth, email, cleanPassword);
        
        await deleteApp(tempApp);
      } catch (authErr: any) {
        console.error("Firebase Auth Creation Error:", authErr);
        if (authErr.code === 'auth/operation-not-allowed') {
           alert('Chức năng đăng nhập Email/Password chưa được kích hoạt trên Firebase. Vui lòng bật nó trong Firebase Console (Authentication -> Sign-in method).');
        } else {
           alert('Lỗi tạo tài khoản Firebase Auth: ' + authErr.message);
        }
        setIsSaving(false);
        return;
      }

      const newSeller: SellerUser = {`;

content = content.substring(0, startIdx) + newLogic + content.substring(startIdx + 33);
fs.writeFileSync('src/components/AdminSellersManager.tsx', content);
