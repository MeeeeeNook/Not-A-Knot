const fs = require('fs');

// Export firebaseConfig
let fbContent = fs.readFileSync('src/firebase.ts', 'utf8');
fbContent = fbContent.replace('const firebaseConfig = {', 'export const firebaseConfig = {');
fs.writeFileSync('src/firebase.ts', fbContent);

// Use it in AdminSellersManager
let amContent = fs.readFileSync('src/components/AdminSellersManager.tsx', 'utf8');
amContent = amContent.replace("import { initializeApp, deleteApp } from 'firebase/app';", "import { initializeApp, deleteApp } from 'firebase/app';\nimport { firebaseConfig } from '../firebase';");
amContent = amContent.replace(/const fbConfig = {[^}]*};\s*const tempApp = initializeApp\(fbConfig/m, "const tempApp = initializeApp(firebaseConfig");
fs.writeFileSync('src/components/AdminSellersManager.tsx', amContent);
