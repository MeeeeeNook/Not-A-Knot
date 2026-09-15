import { SellerUser } from '../types';

// Cryptographic Salt and SHA-256 Hash using browser standard Web Crypto API
export const generateSalt = (length = 16): string => {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

export const hashPassword = async (password: string, salt: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${salt}:${password}:nak_secure_salt_2026`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback if subtle crypto is somehow unavailable
  let hash = 0;
  const str = `${salt}:${password}:nak_salt_fallback`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
};

export const verifyPassword = async (
  inputPassword: string,
  salt: string,
  storedHash: string
): Promise<boolean> => {
  const computedHash = await hashPassword(inputPassword, salt);
  return computedHash === storedHash;
};

// Reversible obfuscation / encryption for stored internal identifiers so plaintext isn't exposed in web bundle
export const decodeSecret = (encoded: string, key = 0x5a): string => {
  try {
    const raw = typeof atob !== 'undefined' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('binary');
    return raw.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (key + (i % 7)))).join('');
  } catch {
    return '';
  }
};

export const encodeSecret = (text: string, key = 0x5a): string => {
  try {
    const xor = text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ (key + (i % 7)))).join('');
    return typeof btoa !== 'undefined' ? btoa(xor) : Buffer.from(xor, 'binary').toString('base64');
  } catch {
    return '';
  }
};

// Initial Root Admin Salt & Hash (SHA-256 with cryptographic salt & pepper)
export const ROOT_ADMIN_USERNAME = 'manhcuong';
export const ROOT_ADMIN_SALT = 'nak_root_salt_mc2026';
export const ROOT_ADMIN_HASH = 'edccde77eea289ae456b004d35b9abebba544bf3d21979848600ba2966f162cd';

// Cryptographic Salt and SHA-256 Hash for usernames
export const USERNAME_SALT = 'nak_username_salt_2026';
export const ROOT_ADMIN_USERNAME_HASH = 'd29a793f2792d9420d04aaeaa94e49059e5c931806add1bab3b7f94c8bea4a0c';

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

export const isRootAdminUsername = async (username: string): Promise<boolean> => {
  const clean = (username || '').trim().toLowerCase();
  if (!clean) return false;
  if (clean === ROOT_ADMIN_USERNAME) return true;
  const computedHash = await hashUsername(clean);
  return computedHash === ROOT_ADMIN_USERNAME_HASH;
};

export const isRootAdminUser = (user?: Partial<SellerUser> | null): boolean => {
  if (!user) return false;
  if (user.isRootAdmin || user.role === 'root_admin') return true;
  const u = (user.username || '').trim().toLowerCase();
  if (u && u === ROOT_ADMIN_USERNAME) return true;
  if (user.usernameHash && user.usernameHash === ROOT_ADMIN_USERNAME_HASH) return true;
  return false;
};

export const COMMON_MEMBER_SALT = 'nak_team_member_salt_2026';
export const DEFAULT_MEMBER_HASH = '9e9528e8f45193607092ef67fd42d9056ee549256543942c4313c114f76ce0ad';

// Generates the initial 9 default team members with natural usernames
export const createDefaultSellers = async (): Promise<SellerUser[]> => {
  const rootHash = ROOT_ADMIN_HASH;
  const commonSalt = COMMON_MEMBER_SALT;
  const defaultMemberHash = DEFAULT_MEMBER_HASH;

  const colors = [
    '#B41C1A', '#D97706', '#059669', '#2563EB', '#7C3AED',
    '#DB2777', '#0891B2', '#4F46E5', '#CA8A04'
  ];

  const defaultTeam: SellerUser[] = [
    {
      id: `seller-${ROOT_ADMIN_USERNAME}`,
      username: ROOT_ADMIN_USERNAME,
      name: 'Mạnh Cường',
      passwordHash: rootHash,
      passwordSalt: ROOT_ADMIN_SALT,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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
      passwordHash: defaultMemberHash,
      passwordSalt: commonSalt,
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

// Storage & Session Cookie Management
const SESSION_STORAGE_KEY = 'notaknot_admin_auth_session';
const COOKIE_NAME = 'nak_admin_token';

export const saveAdminSession = (user: SellerUser, remember = true): void => {
  if (typeof window === 'undefined') return;
  try {
    // Sanitize user object (never store raw passwords, only safe session info)
    const sessionData = {
      id: user.id,
      username: user.username,
      usernameHash: user.usernameHash,
      name: user.name,
      role: user.role,
      isRootAdmin: !!user.isRootAdmin,
      avatarColor: user.avatarColor,
      loggedInAt: new Date().toISOString(),
      expiresAt: remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000
    };
    
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(sessionData))));
    localStorage.setItem(SESSION_STORAGE_KEY, encoded);

    // Also set document cookie for 30 days
    if (remember) {
      const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
      document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  } catch (e) {
    console.warn('Failed to save session:', e);
  }
};

export const getAdminSession = (): Partial<SellerUser> | null => {
  if (typeof window === 'undefined') return null;
  try {
    let raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      // Fallback: check cookie
      const match = document.cookie.match(new RegExp('(^| )' + COOKIE_NAME + '=([^;]+)'));
      if (match && match[2]) {
        raw = match[2];
      }
    }

    if (!raw) return null;

    const decoded = decodeURIComponent(escape(atob(raw)));
    const session = JSON.parse(decoded);

    // Check expiration
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearAdminSession();
      return null;
    }

    return session;
  } catch {
    clearAdminSession();
    return null;
  }
};

export const clearAdminSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch (e) {
    console.warn('Failed to clear session:', e);
  }
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
};

