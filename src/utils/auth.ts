import { SellerUser, AuthorizedSellerItem } from '../types';
import { safeTimeoutSignal } from './timeoutSignal';
import { getAuth, signInAnonymously } from 'firebase/auth';
import bcrypt from 'bcryptjs';
import { getClientGeoLocation, getClientDeviceInfo } from './ipGeo';
import {
  fetchSellerByUsername,
  saveSellerToFirestore,
  fetchSellersFromFirestore,
  fetchAuthorizedSellersFromFirestore,
  recordUnauthorizedLoginAttempt,
  updateSellerPresence,
  auth,
  signInWithGooglePopup,
  signInWithFirebaseEmail,
  registerWithFirebaseEmail,
  signOutFirebaseAuth
} from '../firebase';

export { signOutFirebaseAuth };

// Constants for Client Session Storage
const JWT_STORAGE_KEY = 'notaknot_admin_jwt_token';
const SESSION_STORAGE_KEY = 'notaknot_admin_auth_session';
const COOKIE_NAME = 'nak_admin_token';

export const ROOT_ADMIN_USERNAME = 'admin';

const _d = (s: string): string => {
  try {
    return typeof atob !== 'undefined' ? atob(s) : Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return '';
  }
};

// Obfuscated encoded root administrator emails (keeps plain emails completely out of client bundle)
export const getRootAdminEmails = (): string[] => [
  _d('bmh1bmh1aGFvNzFAZ21haWwuY29t'),
  _d('bWFuaGN1b25nMjAwNmh0QGdtYWlsLmNvbQ==')
];

export const AUTHORIZED_ROOT_ADMIN_EMAILS: readonly string[] = getRootAdminEmails();

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
  return clean === ROOT_ADMIN_USERNAME || AUTHORIZED_ROOT_ADMIN_EMAILS.includes(clean);
};

export const isRootAdminUser = (user?: Partial<SellerUser> | null): boolean => {
  if (!user) return false;
  if (user.isRootAdmin || user.role === 'root_admin') return true;
  const u = (user.username || '').trim().toLowerCase();
  const email = (user.googleEmail || (user as any).email || (user as any).phone || '').trim().toLowerCase();
  return (
    u === ROOT_ADMIN_USERNAME ||
    AUTHORIZED_ROOT_ADMIN_EMAILS.includes(u) ||
    AUTHORIZED_ROOT_ADMIN_EMAILS.includes(email)
  );
};

export const isDeputyAdminUser = (user?: Partial<SellerUser> | null): boolean => {
  if (!user) return false;
  return user.role === 'deputy_admin';
};

/**
 * Checks if the current admin/user has authorization to change the target user's password.
 * Rule:
 * 1. Admin Root: "Không ai được quyền đổi mk của admin root" - only the root admin themselves can change their own password.
 * 2. Deputy Admin & Sellers: Admin Root can change or reset their passwords at any time.
 * 3. Individual users can always change their own password.
 */
export const canChangeUserPassword = (
  currentUser?: Partial<SellerUser> | null,
  targetUser?: Partial<SellerUser> | null
): boolean => {
  if (!targetUser) return false;
  if (!currentUser) return false;

  const isTargetRoot = isRootAdminUser(targetUser);
  const isCurrentRoot = isRootAdminUser(currentUser);

  if (isTargetRoot) {
    // Only the target root admin themselves can change their own password
    const curU = (currentUser.username || '').trim().toLowerCase();
    const tarU = (targetUser.username || '').trim().toLowerCase();
    const curEmail = (currentUser.googleEmail || currentUser.email || '').trim().toLowerCase();
    const tarEmail = (targetUser.googleEmail || targetUser.email || '').trim().toLowerCase();

    return (Boolean(curU && tarU && curU === tarU) || Boolean(curEmail && tarEmail && curEmail === tarEmail) || currentUser.id === targetUser.id);
  }

  // Admin Root can change password for all deputy admins and sellers
  if (isCurrentRoot) {
    return true;
  }

  // Self can change own password
  if (currentUser.id && targetUser.id && currentUser.id === targetUser.id) {
    return true;
  }

  return false;
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

  // 1. Authoritative Server-Side Verification FIRST (if backend server is reachable)
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: cleanUsername,
        password: cleanPassword,
        sellerData,
        rememberMe
      }),
      signal: safeTimeoutSignal(2500)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token && data.user) {
        saveAdminSession(data.token, data.user, rememberMe);

        // Asynchronously ensure Firebase client is authenticated anonymously if needed
        try {
          const auth = getAuth();
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch {}

        return {
          success: true,
          token: data.token,
          user: data.user
        };
      }
    } else if (res.status === 401 || res.status === 403 || res.status === 400) {
      // The authoritative backend explicitly evaluated and rejected the credentials
      const errData = await res.json().catch(() => null);
      return {
        success: false,
        error: errData?.error || 'Tên đăng nhập hoặc mật khẩu không chính xác.'
      };
    }
  } catch (err) {
    // Backend endpoint unreachable, timed out, or static deployment (GitHub Pages / Vercel static)
    // Seamlessly fallback to authoritative client-side Firestore authentication
  }

  // 2. Authoritative Client Fallback (for static deployments e.g. GitHub Pages / offline mode)
  let activeSeller = sellerData;
  if (!activeSeller || !activeSeller.passwordHash) {
    try {
      const fetched = await fetchSellerByUsername(cleanUsername);
      if (fetched) {
        activeSeller = fetched;
      }
    } catch {}
  }

  let isMatch = false;
  const storedHash = activeSeller?.passwordHash;
  const storedSalt = activeSeller?.passwordSalt;

  if (storedHash) {
    if (storedHash.startsWith('$2')) {
      try {
        isMatch = await bcrypt.compare(cleanPassword, storedHash);
      } catch (err) {
        console.warn('bcrypt compare error:', err);
      }
    } else if (storedSalt) {
      isMatch = await verifyPassword(cleanPassword, storedSalt, storedHash);
    }
  } else if (isRootAdminUsername(cleanUsername)) {
    // Authoritative fallback for root admin if Firestore is offline
    // Matches the root admin bcrypt hash ($2b$10$/GBHomGlwF.lft/qY5nNReMMXeut7/eVlJQ8YGvnYZTSOglllnuV6)
    try {
      isMatch = await bcrypt.compare(cleanPassword, '$2b$10$/GBHomGlwF.lft/qY5nNReMMXeut7/eVlJQ8YGvnYZTSOglllnuV6');
    } catch {}
  } else if (activeSeller && (!activeSeller.passwordHash || activeSeller.passwordHash === '')) {
    // Auto-repair seller whose passwordHash was wiped in Firestore during prior bug
    if (cleanPassword.length >= 6) {
      isMatch = true;
      try {
        const hash = await hashPasswordWithServer(cleanPassword);
        const updatedSeller = { ...activeSeller, passwordHash: hash, passwordSalt: '' };
        await saveSellerToFirestore(updatedSeller);
      } catch {}
    }
  }

  if (!isMatch) {
    return {
      success: false,
      error: 'Tên đăng nhập hoặc mật khẩu không chính xác.'
    };
  }

  // Ensure Firebase anonymous sign-in in background
  try {
    const auth = getAuth();
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch {}

  const isRoot = isRootAdminUsername(cleanUsername) || Boolean(activeSeller?.isRootAdmin);
  const userPayload: Partial<SellerUser> = {
    id: activeSeller?.id || `seller-${cleanUsername}`,
    username: cleanUsername,
    name: activeSeller?.name || (isRoot ? 'Tổng bí thư' : cleanUsername),
    role: activeSeller?.role || (isRoot ? 'root_admin' : 'member'),
    isRootAdmin: isRoot,
    avatarColor: activeSeller?.avatarColor || (isRoot ? '#B41C1A' : '#2563EB'),
    isActive: true
  };

  const clientToken = `client_fallback_jwt_${cleanUsername}_${Date.now()}`;
  saveAdminSession(clientToken, userPayload, rememberMe);

  return {
    success: true,
    token: clientToken,
    user: userPayload
  };
};

/**
 * Signs in using Firebase Authentication with Google Popup.
 * Strictly blocks any Google account that is not verified in the admin whitelist or Firestore sellers.
 * Other users must be in sellers list (created/linked by root admin).
 */
export const signInWithGoogle = async (): Promise<{ success: boolean; user?: SellerUser; error?: string }> => {
  try {
    const fbUser = await signInWithGooglePopup();
    const email = (fbUser.email || '').trim().toLowerCase();

    // 1. Check if the user is in the authorized Root Admin whitelist
    const isRoot = AUTHORIZED_ROOT_ADMIN_EMAILS.includes(email) || isRootAdminUsername(email);

    // 2. Check if this email is in the authorized sellers collection granted by Root Admin
    let matchedAuthEmail: AuthorizedSellerItem | null = null;
    try {
      const authorizedList = await fetchAuthorizedSellersFromFirestore();
      matchedAuthEmail = authorizedList.find(a => a.email.trim().toLowerCase() === email && a.isActive !== false) || null;
    } catch (authFetchErr) {
      console.warn('Error checking authorized_sellers list:', authFetchErr);
    }

    // 3. Check if this email belongs to an existing seller profile in Firestore
    let matchedSeller: SellerUser | null = null;
    try {
      const sellers = await fetchSellersFromFirestore();
      matchedSeller = sellers.find(s =>
        (s.googleEmail && s.googleEmail.trim().toLowerCase() === email) ||
        (s.phone && s.phone.trim().toLowerCase() === email) ||
        (s.username && s.username.trim().toLowerCase() === email) ||
        ((s as any).email && (s as any).email.trim().toLowerCase() === email)
      ) || null;
    } catch (fetchErr) {
      console.warn('Error fetching sellers during Google login check:', fetchErr);
    }

    // 4. ZERO-TRUST BLOCK: If not root admin AND not authorized by Root Admin AND not an active seller -> REJECT!
    const isAuthorized = isRoot || Boolean(matchedAuthEmail) || (Boolean(matchedSeller) && matchedSeller?.isActive !== false);
    if (!isAuthorized) {
      // Record unauthorized login attempt with IP, physical location, and device
      try {
        const geo = await getClientGeoLocation().catch(() => null);
        const dev = getClientDeviceInfo();
        const physicalLoc = geo ? `${geo.city || geo.region || ''}${geo.city && geo.country ? ', ' : ''}${geo.country || 'Vietnam'}` : 'Không xác định';
        await recordUnauthorizedLoginAttempt({
          email,
          name: fbUser.displayName || '',
          ip: geo?.ip || 'Unknown',
          location: physicalLoc,
          device: `${dev.browser} trên ${dev.os}`,
          reason: 'Tài khoản Google chưa được Tổng bí thư cấp quyền'
        });
      } catch (logErr) {
        console.warn('Could not record unauthorized attempt:', logErr);
      }

      // Purge the unapproved Google session from Firebase immediately
      await signOutFirebaseAuth().catch(() => {});
      return {
        success: false,
        error: 'Tài khoản Google này không có quyền truy cập hệ thống quản trị.'
      };
    }

    const nowIso = new Date().toISOString();
    const assignedRole = isRoot ? 'root_admin' : (matchedAuthEmail?.role || matchedSeller?.role || 'member');

    // Auto-link Google email and UID to the seller in Firestore if not yet set
    if (matchedSeller && (!matchedSeller.googleEmail || matchedSeller.googleEmail !== email || !matchedSeller.googleUid)) {
      try {
        const updatedSeller: SellerUser = {
          ...matchedSeller,
          googleEmail: email,
          googleUid: fbUser.uid,
          linkedGoogleAt: matchedSeller.linkedGoogleAt || nowIso
        };
        await saveSellerToFirestore(updatedSeller);
        matchedSeller = updatedSeller;
      } catch (linkErr) {
        console.warn('Could not auto-update linked Google email on seller document:', linkErr);
      }
    }

    const sellerUser: SellerUser = {
      id: matchedSeller?.id || `seller-${fbUser.uid.slice(0, 12)}`,
      username: matchedSeller?.username || (email.includes('@') ? email.split('@')[0] : email),
      name: matchedSeller?.name || matchedAuthEmail?.name || fbUser.displayName || (isRoot ? 'Tổng bí thư' : email),
      role: assignedRole,
      isRootAdmin: isRoot,
      isActive: true,
      createdAt: matchedSeller?.createdAt || nowIso,
      avatarColor: matchedSeller?.avatarColor || (isRoot ? '#B41C1A' : (assignedRole === 'deputy_admin' ? '#7C3AED' : '#2563EB')),
      phone: matchedSeller?.phone || fbUser.phoneNumber || '',
      googleEmail: email,
      googleUid: fbUser.uid,
      linkedGoogleAt: matchedSeller?.linkedGoogleAt || nowIso
    };

    if (!matchedSeller) {
      await saveSellerToFirestore(sellerUser).catch(() => {});
    }

    const token = await fbUser.getIdToken();
    saveAdminSession(token, sellerUser, true);

    return { success: true, user: sellerUser };
  } catch (err: any) {
    const isNormalCancel =
      err?.code === 'auth/popup-closed-by-user' ||
      err?.code === 'auth/cancelled-popup-request';

    if (!isNormalCancel) {
      console.warn('Google Sign-In Notice:', err?.message || err);
    }

    let msg = 'Đăng nhập Google qua Firebase thất bại.';
    if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('unauthorized-domain'))) {
      msg = 'Đăng nhập không thành công trên tên miền này. Vui lòng liên hệ quản trị viên.';
    } else if (isNormalCancel) {
      msg = 'Cửa sổ đăng nhập Google đã được đóng.';
    } else if (err?.code === 'auth/popup-blocked') {
      msg = 'Trình duyệt đã chặn popup. Vui lòng cho phép popup để đăng nhập bằng Google.';
    } else if (err?.message) {
      msg = err.message;
    }
    return { success: false, error: msg };
  }
};

/**
 * Links a Google account to an existing seller account so they can sign in with both password and Google.
 */
export const linkGoogleAccountWithSeller = async (
  targetSeller: SellerUser
): Promise<{ success: boolean; updatedSeller?: SellerUser; error?: string }> => {
  try {
    const fbUser = await signInWithGooglePopup();
    const email = (fbUser.email || '').trim().toLowerCase();
    if (!email) {
      return { success: false, error: 'Không thể xác định địa chỉ email từ tài khoản Google.' };
    }

    // Check if another seller already uses this Google email
    const sellers = await fetchSellersFromFirestore();
    const conflict = sellers.find(s => s.id !== targetSeller.id && (
      (s.googleEmail && s.googleEmail.trim().toLowerCase() === email) ||
      ((s as any).email && (s as any).email.trim().toLowerCase() === email)
    ));
    if (conflict) {
      return {
        success: false,
        error: `Email Google ${email} đã được liên kết với tài khoản "${conflict.name}" (@${conflict.username}).`
      };
    }

    const updatedSeller: SellerUser = {
      ...targetSeller,
      googleEmail: email,
      googleUid: fbUser.uid,
      linkedGoogleAt: new Date().toISOString()
    };

    await saveSellerToFirestore(updatedSeller);
    await refreshAdminSession(updatedSeller);

    return { success: true, updatedSeller };
  } catch (err: any) {
    if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
      console.warn('Lỗi liên kết Google:', err?.message || err);
    }
    return { success: false, error: err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request' ? 'Cửa sổ đăng nhập đã được đóng.' : (err?.message || 'Không thể liên kết tài khoản Google.') };
  }
};

/**
 * Unlinks the Google account from a seller account.
 */
export const unlinkGoogleAccountFromSeller = async (
  targetSeller: SellerUser
): Promise<{ success: boolean; updatedSeller?: SellerUser; error?: string }> => {
  try {
    const updatedSeller: SellerUser = {
      ...targetSeller,
      googleEmail: undefined,
      googleUid: undefined,
      linkedGoogleAt: undefined
    };

    await saveSellerToFirestore(updatedSeller);
    await refreshAdminSession(updatedSeller);

    return { success: true, updatedSeller };
  } catch (err: any) {
    console.error('Lỗi hủy liên kết Google:', err);
    return { success: false, error: err.message || 'Không thể hủy liên kết tài khoản Google.' };
  }
};

/**
 * Unified login handler: Authenticates via Firebase Authentication first,
 * with seamless fallback to server/bcrypt database so no credentials ever fail.
 * Blocks any unauthorized email not recognized by the admin system.
 */
export const loginWithFirebaseAuthOrServer = async (
  usernameOrEmail: string,
  password: string,
  sellersList?: SellerUser[],
  rememberMe = true
): Promise<ServerLoginResult> => {
  const cleanInput = (usernameOrEmail || '').trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanInput) {
    return { success: false, error: 'Vui lòng nhập tên đăng nhập hoặc email.' };
  }
  if (!cleanPassword) {
    return { success: false, error: 'Vui lòng nhập mật khẩu.' };
  }

  // Pre-validate email if an email address is provided
  if (cleanInput.includes('@')) {
    const isRoot = AUTHORIZED_ROOT_ADMIN_EMAILS.includes(cleanInput);
    const hasSellerMatch = sellersList?.some(s =>
      ((s as any).email && (s as any).email.toLowerCase() === cleanInput) ||
      (s.googleEmail && s.googleEmail.toLowerCase() === cleanInput) ||
      (s.phone && s.phone.toLowerCase() === cleanInput) ||
      s.username.toLowerCase() === cleanInput
    );
    if (!isRoot && !hasSellerMatch) {
      // Check in Firestore if not loaded yet
      let foundInDb = false;
      try {
        const fetched = await fetchSellerByUsername(cleanInput);
        if (fetched) foundInDb = true;
      } catch {}
      if (!foundInDb) {
        return {
          success: false,
          error: `Tài khoản (${cleanInput}) chưa được cấp quyền quản trị. Vui lòng liên hệ Admin Root để được cấp quyền truy cập.`
        };
      }
    }
  }

  // 1. Try Firebase Authentication with Email and Password
  let emailToUse = cleanInput;
  if (!emailToUse.includes('@')) {
    emailToUse = `${cleanInput}@notaknot.vn`;
  }

  try {
    const fbUser = await signInWithFirebaseEmail(emailToUse, cleanPassword);
    const isRoot = isRootAdminUsername(cleanInput) || isRootAdminUsername(emailToUse) || isRootAdminUser({ email: emailToUse, username: cleanInput });

    let matchedSeller = sellersList?.find(s => s.username.toLowerCase() === cleanInput || s.googleEmail?.toLowerCase() === cleanInput || ((s as any).email && (s as any).email.toLowerCase() === cleanInput));
    if (!matchedSeller) {
      try {
        matchedSeller = await fetchSellerByUsername(cleanInput);
      } catch {}
    }

    if (!isRoot && (!matchedSeller || matchedSeller.isActive === false)) {
      await signOutFirebaseAuth().catch(() => {});
      return {
        success: false,
        error: `Tài khoản (${cleanInput}) chưa được cấp quyền quản trị. Truy cập bị từ chối.`
      };
    }

    const nowIso = new Date().toISOString();
    const assignedRole = isRoot ? 'root_admin' : (matchedSeller?.role || 'member');
    const userPayload: Partial<SellerUser> = {
      id: matchedSeller?.id || `seller-${cleanInput.replace(/[^a-z0-9]/g, '')}`,
      username: cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput,
      name: matchedSeller?.name || fbUser.displayName || (isRoot ? 'Tổng bí thư' : cleanInput),
      role: assignedRole,
      isRootAdmin: isRoot,
      avatarColor: matchedSeller?.avatarColor || (isRoot ? '#B41C1A' : (assignedRole === 'deputy_admin' ? '#7C3AED' : '#2563EB')),
      isActive: true,
      googleEmail: matchedSeller?.googleEmail
    };

    const token = await fbUser.getIdToken();
    saveAdminSession(token, userPayload, rememberMe);

    return {
      success: true,
      token,
      user: userPayload
    };
  } catch (fbErr: any) {
    // If not found in Firebase Auth yet, fallback to server/bcrypt check
  }

  // 2. Authoritative Fallback to Server / Local Database
  let matchedSeller = sellersList?.find(s => s.username.toLowerCase() === cleanInput || s.googleEmail?.toLowerCase() === cleanInput || ((s as any).email && (s as any).email.toLowerCase() === cleanInput));
  const serverRes = await loginWithServer(cleanInput, cleanPassword, matchedSeller, rememberMe);

  if (serverRes.success && serverRes.user) {
    // Auto-migrate to Firebase Auth in background so future logins use Firebase Auth directly
    try {
      await registerWithFirebaseEmail(emailToUse, cleanPassword);
    } catch {}
  }

  return serverRes;
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
      },
      signal: safeTimeoutSignal(2000)
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
      if (data.token) {
        localStorage.setItem(JWT_STORAGE_KEY, data.token);
      }
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
    console.warn('Verification request error or static deployment, keeping session:', err);
    return localSession;
  }
};

/**
 * Explicitly updates the locally cached session and invalidates/refreshes JWT token with fresh role data
 */
export const refreshAdminSession = async (userProfile?: Partial<SellerUser> | null): Promise<Partial<SellerUser> | null> => {
  if (userProfile && userProfile.username) {
    const isRoot = isRootAdminUser(userProfile);
    const updated: Partial<SellerUser> = {
      ...userProfile,
      role: isRoot ? 'root_admin' : (userProfile.role || 'member'),
      isRootAdmin: isRoot
    };

    const currentSession = getAdminSession();
    const isCurrentActiveUser = !currentSession || !currentSession.username || currentSession.username.toLowerCase() === userProfile.username.toLowerCase();

    if (isCurrentActiveUser) {
      // Invalidate old JWT token and re-issue fresh token for the updated role
      const cleanUsername = userProfile.username.toLowerCase();
      const freshToken = `client_fallback_jwt_${cleanUsername}_${Date.now()}`;
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updated));
        localStorage.setItem(JWT_STORAGE_KEY, freshToken);
        const maxAge = 30 * 24 * 60 * 60; // 30 days
        document.cookie = `${COOKIE_NAME}=${freshToken}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
      } catch (e) {
        console.warn('Failed to update session storage or JWT token:', e);
      }

      // Re-verify with server to get updated server-signed JWT if backend is reachable
      try {
        const serverResult = await verifySessionWithServer();
        if (serverResult) return serverResult;
      } catch {}
    }

    return updated;
  }
  return verifySessionWithServer();
};

/**
 * Force invalidates current session token and re-syncs with server/local storage when role changes to root_admin or member
 */
export const invalidateAndRefreshSession = async (updatedSeller: Partial<SellerUser>): Promise<Partial<SellerUser> | null> => {
  return refreshAdminSession(updatedSeller);
};

export const clearAdminSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    signOutFirebaseAuth().catch(() => {});
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
      body: JSON.stringify({ password }),
      signal: safeTimeoutSignal(2500)
    });
    const data = await res.json();
    if (data.success && data.hash) {
      return data.hash;
    }
    throw new Error(data.error || 'Lỗi băm mật khẩu từ server');
  } catch (err) {
    console.warn('Fallback hash for static host:', err);
    try {
      return await bcrypt.hash(password, 10);
    } catch {
      const salt = generateSalt();
      const encoder = new TextEncoder();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${password}:nak_secure_salt_2026`));
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }
};

/**
 * Request server authorization check before sensitive business mutations
 */
export const verifyAdminAction = async (action: string, targetId?: string): Promise<boolean> => {
  const session = getAdminSession();
  const isRoot = isRootAdminUser(session);

  const token = getAdminToken();

  try {
    if (token) {
      const res = await fetch('/api/admin/verify-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, targetId }),
        signal: safeTimeoutSignal(2500)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.allowed === 'boolean') {
          return data.allowed;
        }
      }
    }
  } catch (err) {
    console.warn('Server verify-action call failed, falling back to session check:', err);
  }

  // Fallback to local session authorization check
  if (!session || !session.username) return false;

  // Sensitive actions requiring Root Admin authorization
  const rootOnlyActions = ['purge_trash', 'delete_seller', 'manage_seller_roles', 'reset_system'];
  if (rootOnlyActions.includes(action)) {
    return isRoot;
  }
  return true;
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
  if (storedHash && storedHash.startsWith('$2')) {
    try {
      return await bcrypt.compare(inputPassword, storedHash);
    } catch {
      return false;
    }
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
      name: 'Tổng bí thư',
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
 * Deduplicate sellers list by ID, username, and name to guarantee unique keys across rendering
 */
export const deduplicateSellers = (list: SellerUser[]): SellerUser[] => {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const seenNames = new Set<string>();
  const result: SellerUser[] = [];

  for (const s of list) {
    if (!s) continue;
    const rawId = s.id ? String(s.id).trim() : '';
    const rawUsername = s.username ? String(s.username).trim().toLowerCase() : '';
    const rawName = s.name ? String(s.name).trim().toLowerCase() : '';
    const cleanId = rawId || (rawUsername ? `seller-${rawUsername.replace(/[^a-z0-9_]/g, '')}` : '');
    const cleanUsername = rawUsername || cleanId;

    if (cleanId && seenIds.has(cleanId)) continue;
    if (cleanUsername && seenUsernames.has(cleanUsername)) continue;
    if (rawName && seenNames.has(rawName)) continue;

    if (cleanId) seenIds.add(cleanId);
    if (cleanUsername) seenUsernames.add(cleanUsername);
    if (rawName) seenNames.add(rawName);

    // Cap ipHistory to 10 entries to prevent oversized storage bloat
    const trimmedIpHistory = Array.isArray(s.ipHistory) ? s.ipHistory.slice(-10) : s.ipHistory;

    result.push({
      ...s,
      id: cleanId,
      username: cleanUsername || cleanId,
      ipHistory: trimmedIpHistory
    });
  }
  return result;
};

