const fs = require('fs');
let content = fs.readFileSync('src/utils/auth.ts', 'utf8');

const importIdx = content.indexOf("import { JwtAdminPayload }");
content = content.slice(0, importIdx) + "import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';\n" + content.slice(importIdx);

const startIdx = content.indexOf("export const loginWithServer = async (");
const endIdx = content.indexOf("export const getAdminToken = (): string | null => {");

const newLogic = `export const loginWithServer = async (
  username: string,
  password: string,
  sellerData?: SellerUser,
  rememberMe = true
): Promise<ServerLoginResult> => {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  try {
    const auth = getAuth();
    const email = \`\${cleanUsername}@notaknot.local\`;
    const userCredential = await signInWithEmailAndPassword(auth, email, cleanPassword);
    const idToken = await userCredential.user.getIdToken();

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idToken,
        sellerData,
        rememberMe
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        saveAdminSession(data.token, data.user, rememberMe);
        return {
          success: true,
          token: data.token,
          user: data.user
        };
      }
    }

    let errorMsg = 'Xác thực với máy chủ thất bại.';
    try {
      const errData = await res.json();
      if (errData.error) errorMsg = errData.error;
    } catch (e) {}

    return {
      success: false,
      error: errorMsg
    };
  } catch (error: any) {
    console.error('Server login error:', error);
    let errorMsg = 'Lỗi kết nối đến máy chủ. Vui lòng thử lại.';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMsg = 'Tên đăng nhập hoặc mật khẩu không chính xác.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMsg = 'Chức năng đăng nhập Email/Password chưa được kích hoạt trên Firebase. Vui lòng liên hệ Admin để kích hoạt.';
    }
    return {
      success: false,
      error: errorMsg
    };
  }
};

`;

const newContent = content.substring(0, startIdx) + newLogic + content.substring(endIdx);
fs.writeFileSync('src/utils/auth.ts', newContent);
