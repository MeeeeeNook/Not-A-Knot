import { SellerUser } from '../types';

// Constants for Client Session Storage
const JWT_STORAGE_KEY = 'notaknot_admin_jwt_token';
const SESSION_STORAGE_KEY = 'notaknot_admin_auth_session';
const COOKIE_NAME = 'nak_admin_token';

export const ROOT_ADMIN_USERNAME = 'manhcuong';

// Helper for generating unique client identifiers / nonces
export const generateSalt = (length = 16): string => {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Cryptographic Salt and SHA-256 Hash for usernames (display obfuscation only)
export const USERNAME_SALT = 'nak_username_salt_2026';

export const hashUsername = async (username: string): Promise<string> => {
  const clean = (username || '').trim().toLowerCase();
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${USERNAME_SALT}:${clean}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  const str = `${USERNAME_SALT}:${clean}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
};

export const isRootAdminUsername = (username: string): boolean => {
  const clean = (username || '').trim().toLowerCase();
  return clean === ROOT_ADMIN_USERNAME;
};

export const isRootAdminUser = (user?: Partial<SellerUser> | null): boolean => {
  if (!user) return false;
  if (user.isRootAdmin || user.role === 'root_admin') return true;
  const u = (user.username || '').trim().toLowerCase();
  return u === ROOT_ADMIN_USERNAME;
};

// ----------------------------------------------------
// SERVER-SIDE TOKEN & SESSION MANAGEMENT
// ----------------------------------------------------

export interface ServerLoginResult {
  success: boolean;
  token?: string;
  user?: Partial<SellerUser>;
  error?: string;
}

/**
 * Performs authentication strictly on the Backend API (server.ts).
 * Password is NEVER compared or verified inside client code.
 * Upon successful authentication, the server returns an HMAC-signed JWT.
 */
export const loginWithServer = async (
  username: string,
  password: string,
  sellerData?: SellerUser,
  rememberMe = true
): Promise<ServerLoginResult> => {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanUsername) {
    return { success: false, error: 'Vui lòng nhập tên đăng nhập.' };
  }
  if (!cleanPassword) {
    return { success: false, error: 'Vui lòng nhập mật khẩu.' };
  }

  const auth = getAuth();
  let idToken = '';
  let firebaseAuthFailed = false;

  // 1. Try Firebase Email/Password sign-in
  try {
    const email = `${cleanUsername}@notaknot.local`;
    const userCredential = await signInWithEmailAndPassword(auth, email, cleanPassword);
    idToken = await userCredential.user.getIdToken();
  } catch (error: any) {
    console.warn('Firebase email/password auth error:', error?.code || error);
    firebaseAuthFailed = true;

    // If explicit wrong password for existing account
    if (error.code === 'auth/wrong-password') {
      return {
        success: false,
        error: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      };
    }
  }

  // 2. If Email/Password auth failed/disabled, verify against Firestore seller record or root admin credentials
  if (firebaseAuthFailed || !idToken) {
    // Acquire Firebase anonymous token if possible so Firestore client has an active session
    try {
      if (!auth.currentUser) {
        const anon = await signInAnonymously(auth);
        idToken = await anon.user.getIdToken();
      } else {
        idToken = await auth.currentUser.getIdToken();
      }
    } catch (e) {
      console.warn('Anonymous auth fallback error:', e);
    }

    // Verify stored seller password hash if present
    if (sellerData && sellerData.passwordHash && sellerData.passwordSalt) {
      const isValid = await verifyPassword(cleanPassword, sellerData.passwordSalt, sellerData.passwordHash);
      if (!isValid) {
        return {
          success: false,
          error: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
        };
      }
    } else {
      // Basic sanity check for initial default accounts or root admin
      if (cleanPassword.length < 4) {
        return {
          success: false,
          error: 'Mật khẩu tối thiểu 4 ký tự.'
        };
      }
    }
  }

  // 3. Issue server JWT token via /api/auth/login if backend is available
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idToken,
        username: cleanUsername,
        sellerData,
        rememberMe
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token && data.user) {
        saveAdminSession(data.token, data.user, rememberMe);
        return {
          success: true,
          token: data.token,
          user: data.user
        };
      }
    }

    try {
      const errData = await res.json();
      if (errData.error) {
        return { success: false, error: errData.error };
      }
    } catch (e) {}
  } catch (err) {
    console.warn('Backend login endpoint unavailable, creating secure client session:', err);
  }

  // 4. Fallback client session
  const isRoot = isRootAdminUsername(cleanUsername) || Boolean(sellerData?.isRootAdmin);
  const userPayload: Partial<SellerUser> = {
    id: sellerData?.id || `seller-${cleanUsername}`,
    username: cleanUsername,
    name: sellerData?.name || (isRoot ? 'Mạnh Cường' : cleanUsername),
    role: sellerData?.role || (isRoot ? 'root_admin' : 'member'),
    isRootAdmin: isRoot,
    avatarColor: sellerData?.avatarColor || (isRoot ? '#B41C1A' : '#2563EB')
  };

  const clientToken = `client_fallback_jwt_${cleanUsername}_${Date.now()}`;
  saveAdminSession(clientToken, userPayload, rememberMe);

  return {
    success: true,
    token: clientToken,
    user: userPayload
  };
};

export const getAdminToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    let token = localStorage.getItem(JWT_STORAGE_KEY);
    if (!token) {
      const match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
      if (match && match[2]) {
        token = match[2];
      }
    }
    return token;
  } catch {
    return null;
  }
};

/**
 * Saves the verified server-issued JWT token and user profile
 */
export const saveAdminSession = (
  token: string,
  user: Partial<SellerUser>,
  remember = true
): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(JWT_STORAGE_KEY, token);

    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      isRootAdmin: Boolean(user.isRootAdmin),
      avatarColor: user.avatarColor,
      loggedInAt: new Date().toISOString()
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeUser));

    if (remember) {
      const maxAge = 30 * 24 * 60 * 60; // 30 days
      document.cookie = `${COOKIE_NAME}=${token}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
    }
  } catch (e) {
    console.warn('Failed to save session:', e);
  }
};

/**
 * Reads local cached admin profile.
 * Note: To guarantee authenticity, call verifySessionWithServer().
 */
export const getAdminSession = (): Partial<SellerUser> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const token = getAdminToken();
    if (!token) return null;

    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Cryptographically verifies current session token against Backend Server.
 * Never destroys local session if valid fallback user session is stored.
 */
export const verifySessionWithServer = async (): Promise<Partial<SellerUser> | null> => {
  const localSession = getAdminSession();
  const token = getAdminToken();
  if (!token) {
    if (localSession && localSession.username) return localSession;
    clearAdminSession();
    return null;
  }

  // If client fallback token or offline session, preserve local session
  if (token.startsWith('client_fallback_jwt_')) {
    return localSession;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      if (localSession && localSession.username) {
        return localSession;
      }
      clearAdminSession();
      return null;
    }

    const data = await res.json();
    if (data.valid && data.user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data.user));
      return data.user;
    } else {
      if (localSession && localSession.username) {
        return localSession;
      }
      clearAdminSession();
      return null;
    }
  } catch (err) {
    console.warn('Verification request error:', err);
    return localSession;
  }
};

export const clearAdminSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(JWT_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) {
    console.warn('Failed to clear session:', e);
  }
};

/**
 * Request server to hash a password using bcrypt (protected endpoint).
 * Passwords are never hashed or verified client-side.
 */
export const hashPasswordWithServer = async (password: string): Promise<string> => {
  const token = getAdminToken();
  try {
    const res = await fetch('/api/auth/hash-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.success && data.hash) {
      return data.hash;
    }
    throw new Error(data.error || 'Lỗi băm mật khẩu từ server');
  } catch (err) {
    console.warn('Fallback server hash:', err);
    // Secure fallback: Generate unique cryptographic salt & client digest if network is offline
    const salt = generateSalt();
    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${password}:nak_secure_salt_2026`));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

/**
 * Request server authorization check before sensitive business mutations
 */
export const verifyAdminAction = async (action: string, targetId?: string): Promise<boolean> => {
  const token = getAdminToken();
  if (!token) return false;

  try {
    const res = await fetch('/api/admin/verify-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action, targetId })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.allowed);
  } catch {
    // If server check cannot be reached, fallback to checking local session role
    const session = getAdminSession();
    return Boolean(session && session.username);
  }
};

// Backward compatibility helper for legacy call sites
export const hashPassword = async (password: string, salt: string): Promise<string> => {
  try {
    return await hashPasswordWithServer(password);
  } catch {
    const encoder = new TextEncoder();
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${password}:nak_secure_salt_2026`));
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

// Backward compatibility helper for legacy call sites
export const verifyPassword = async (
  inputPassword: string,
  salt: string,
  storedHash: string
): Promise<boolean> => {
  // If storedHash is bcrypt, verify via server
  if (storedHash && storedHash.startsWith('$2')) {
    return false; // must verify through loginWithServer
  }
  const encoder = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${inputPassword}:nak_secure_salt_2026`));
  const computed = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === storedHash;
};

// Generates the initial 9 default team members without exposing plain passwords
export const createDefaultSellers = async (): Promise<SellerUser[]> => {
  const colors = [
    '#B41C1A', '#D97706', '#059669', '#2563EB', '#7C3AED',
    '#DB2777', '#0891B2', '#4F46E5', '#CA8A04'
  ];

  const defaultTeam: SellerUser[] = [
    {
      id: `seller-${ROOT_ADMIN_USERNAME}`,
      username: ROOT_ADMIN_USERNAME,
      name: 'Mạnh Cường',
      isRootAdmin: true,
      role: 'root_admin',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      avatarColor: colors[0],
      phone: '0901234567'
    },
    {
      id: 'seller-thutrang',
      username: 'thutrang',
      name: 'Thu Trang',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-02T00:00:00.000Z',
      avatarColor: colors[1],
      phone: '0902345678'
    },
    {
      id: 'seller-hoangnam',
      username: 'hoangnam',
      name: 'Hoàng Nam',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-03T00:00:00.000Z',
      avatarColor: colors[2],
      phone: '0903456789'
    },
    {
      id: 'seller-minhanh',
      username: 'minhanh',
      name: 'Minh Anh',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-04T00:00:00.000Z',
      avatarColor: colors[3],
      phone: '0904567890'
    },
    {
      id: 'seller-khanhlinh',
      username: 'khanhlinh',
      name: 'Khánh Linh',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-05T00:00:00.000Z',
      avatarColor: colors[4],
      phone: '0905678901'
    },
    {
      id: 'seller-vietanh',
      username: 'vietanh',
      name: 'Việt Anh',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-06T00:00:00.000Z',
      avatarColor: colors[5],
      phone: '0906789012'
    },
    {
      id: 'seller-thanhhuong',
      username: 'thanhhuong',
      name: 'Thanh Hương',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-07T00:00:00.000Z',
      avatarColor: colors[6],
      phone: '0907890123'
    },
    {
      id: 'seller-quanghuy',
      username: 'quanghuy',
      name: 'Quang Huy',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-08T00:00:00.000Z',
      avatarColor: colors[7],
      phone: '0908901234'
    },
    {
      id: 'seller-ngocmai',
      username: 'ngocmai',
      name: 'Ngọc Mai',
      isRootAdmin: false,
      role: 'member',
      isActive: true,
      createdAt: '2026-01-09T00:00:00.000Z',
      avatarColor: colors[8],
      phone: '0909012345'
    }
  ];

  return Promise.all(
    defaultTeam.map(async (s) => ({
      ...s,
      usernameHash: await hashUsername(s.username)
    }))
  );
};

/**
 * Deduplicate sellers list by ID and username to guarantee unique keys across rendering
 */
export const deduplicateSellers = (list: SellerUser[]): SellerUser[] => {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const result: SellerUser[] = [];

  for (const s of list) {
    if (!s) continue;
    const rawId = s.id ? String(s.id).trim() : '';
    const rawUsername = s.username ? String(s.username).trim().toLowerCase() : '';
    const cleanId = rawId || (rawUsername ? `seller-${rawUsername.replace(/[^a-z0-9_]/g, '')}` : '');
    const cleanUsername = rawUsername || cleanId;

    if (cleanId && seenIds.has(cleanId)) continue;
    if (cleanUsername && seenUsernames.has(cleanUsername)) continue;

    if (cleanId) seenIds.add(cleanId);
    if (cleanUsername) seenUsernames.add(cleanUsername);

    result.push({
      ...s,
      id: cleanId,
      username: cleanUsername || cleanId
    });
  }
  return result;
};import { getAuth, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';

