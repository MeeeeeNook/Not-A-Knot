const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const startIdx = content.indexOf("app.post('/api/auth/login'");
const endIdx = content.indexOf("app.get('/api/auth/verify'");

const newLogic = `app.post('/api/auth/login', authLoginLimiter, async (req: Request, res: Response) => {
    try {
      const { idToken, sellerData, rememberMe = true } = req.body;

      if (!idToken) {
        return res.status(400).json({ error: 'Thiếu Firebase ID Token.' });
      }

      let firebaseUid = '';
      let firebaseEmail = '';
      if (FIREBASE_API_KEY) {
        const verifyRes = await fetch(\`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=\${FIREBASE_API_KEY}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.users && verifyData.users.length > 0) {
          firebaseUid = verifyData.users[0].localId;
          firebaseEmail = verifyData.users[0].email;
        } else {
          return res.status(401).json({ error: 'Firebase ID Token không hợp lệ.' });
        }
      } else {
         return res.status(500).json({ error: 'Server missing FIREBASE_API_KEY for token verification.' });
      }
      
      const isRoot = sellerData?.isRootAdmin === true;
      
      if (isRoot) {
        const userPayload: JwtAdminPayload = {
          id: firebaseUid,
          username: firebaseEmail.split('@')[0],
          name: sellerData?.name || 'Quản Trị Viên Gốc',
          role: 'root_admin',
          isRootAdmin: true,
          avatarColor: sellerData?.avatarColor || '#B41C1A',
          issuedAt: new Date().toISOString()
        };

        const token = jwt.sign(
          userPayload,
          JWT_SECRET,
          { expiresIn: rememberMe ? '30d' : '24h' }
        );

        return res.json({
          success: true,
          token,
          user: userPayload
        });
      }

      const memberPayload: JwtAdminPayload = {
        id: firebaseUid,
        username: firebaseEmail.split('@')[0],
        name: sellerData?.name || firebaseEmail.split('@')[0],
        role: sellerData?.role || 'member',
        isRootAdmin: false,
        avatarColor: sellerData?.avatarColor || '#2563EB',
        issuedAt: new Date().toISOString()
      };

      const token = jwt.sign(
        memberPayload,
        JWT_SECRET,
        { expiresIn: rememberMe ? '30d' : '24h' }
      );

      return res.json({
        success: true,
        token,
        user: memberPayload
      });
    } catch (err: any) {
      console.error('[Auth API] Login error:', err);
      return res.status(500).json({ error: 'Lỗi xử lý xác thực trên máy chủ.' });
    }
  });

  /**
   * GET /api/auth/verify
`;

const newContent = content.substring(0, startIdx) + newLogic + content.substring(endIdx + 29); // +29 to offset the match
fs.writeFileSync('server.ts', newContent);
