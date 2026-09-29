import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, auth, cleanFirestoreData, isQuotaExhaustedError } from '../firebase';
import { SystemLogItem, LogType, LogLevel } from '../types';
import { getClientGeoLocation, getClientDeviceInfo } from './ipGeo';

const LOCAL_STORAGE_LOGS_KEY = 'nak_system_logs_local';
const MAX_LOCAL_LOGS = 250;
const LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30-day retention window for audit trail
const DEDUP_WINDOW_MS = 15 * 60 * 1000; // 15-minute window for deduplication

/**
 * Saves a log to local storage as fallback and for offline retrieval.
 */
function saveLogToLocal(log: SystemLogItem) {
  try {
    const existing: SystemLogItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
    const cutoffTime = Date.now() - LOG_RETENTION_MS;
    
    // Filter out logs older than 30 days
    const valid = existing.filter((item) => {
      const t = new Date(item.timestamp).getTime();
      return !isNaN(t) && t >= cutoffTime && item.id !== log.id;
    });

    const updated = [log, ...valid].slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Retrieves local fallback logs (filtering logs older than 30 days).
 */
export function getLocalLogs(): SystemLogItem[] {
  try {
    const cutoffTime = Date.now() - LOG_RETENTION_MS;
    const items: SystemLogItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
    return items.filter((item) => {
      const t = new Date(item.timestamp).getTime();
      return !isNaN(t) && t >= cutoffTime;
    });
  } catch {
    return [];
  }
}

/**
 * Determines whether an error message is benign browser noise
 * (e.g. AbortController cancellations, Vite HMR WebSocket disconnects, ResizeObserver)
 * that should never be logged or stored.
 */
export function isIgnorableClientError(message: string, stack?: string): boolean {
  if (!message) return false;
  const lowerMsg = (message + ' ' + (stack || '')).toLowerCase();
  
  // 1. User aborts (e.g. user cancellations, switching routes, debounced search requests)
  if (
    lowerMsg.includes('aborted') ||
    lowerMsg.includes('the user aborted a request') ||
    lowerMsg.includes('the operation was aborted') ||
    lowerMsg.includes('aborterror') ||
    lowerMsg.includes('signal is aborted')
  ) {
    return true;
  }

  // 2. Dev server WebSocket / HMR noise
  if (
    lowerMsg.includes('websocket closed without opened') ||
    lowerMsg.includes('websocket is already in closing') ||
    lowerMsg.includes('websocket connection') ||
    lowerMsg.includes('vite') && lowerMsg.includes('ws')
  ) {
    return true;
  }

  // 3. Benign DOM observation / cross-origin script error / sandbox constructor restriction
  if (
    lowerMsg.includes('resizeobserver') ||
    lowerMsg.includes('script error.') ||
    lowerMsg.includes('illegal constructor')
  ) {
    return true;
  }

  // 4. Page unload / background tab network drops
  if (
    (lowerMsg.includes('failed to fetch') || lowerMsg.includes('load failed') || lowerMsg.includes('networkerror')) &&
    typeof document !== 'undefined' &&
    (document.visibilityState === 'hidden' || (typeof navigator !== 'undefined' && !navigator.onLine))
  ) {
    return true;
  }

  return false;
}

/**
 * Purges Firestore and local storage log entries older than 30 days.
 */
export async function cleanUpOldLogsFromFirestore(): Promise<void> {
  const cutoffTime = Date.now() - LOG_RETENTION_MS;

  // Clean local storage
  try {
    const local = getLocalLogs().filter((l) => {
      const t = new Date(l.timestamp).getTime();
      return !isNaN(t) && t >= cutoffTime && !isIgnorableClientError(l.message || l.title || '');
    });
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(local));
  } catch {}

  // Clean Firestore system_logs only if authenticated as staff/admin
  if (auth.currentUser) {
    try {
      const snapshot = await getDocs(query(collection(db, 'system_logs'), limit(200)));
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const t = new Date(data.timestamp || 0).getTime();
        const isExpired = isNaN(t) || t < cutoffTime;
        const isBenignNoise = data.type === 'client_error' && isIgnorableClientError(data.message || data.title || '');

        if (isExpired || isBenignNoise) {
          batch.delete(docSnap.ref);
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        console.log(`[SystemLog] Cleaned ${count} expired or ignorable log items.`);
      }
    } catch (err: any) {
      if (!isQuotaExhaustedError(err) && err?.code !== 'permission-denied') {
        console.warn('Could not clean old logs from Firestore:', err);
      }
    }
  }
}

/**
 * Filters out logs older than 30 days, removes ignorable browser noise,
 * and compresses consecutive / similar adjacent logs into single entries.
 */
export function compressAndFilterLogs(rawLogs: SystemLogItem[]): SystemLogItem[] {
  const cutoffTime = Date.now() - LOG_RETENTION_MS;

  // 1. Filter out logs older than 30 days and ignorable benign browser noise
  const validLogs = rawLogs.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    if (isNaN(t) || t < cutoffTime) return false;
    if (l.type === 'client_error' && isIgnorableClientError(l.message || l.title || '')) {
      return false;
    }
    return true;
  });

  // Sort descending by timestamp
  validLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 2. Compress identical or adjacent logs (same type + title + userId/ip)
  const result: SystemLogItem[] = [];

  for (const log of validLogs) {
    if (result.length === 0) {
      result.push({ ...log, count: log.count || 1 });
      continue;
    }

    const prev = result[result.length - 1];
    const logTime = new Date(log.timestamp).getTime();
    const prevTime = new Date(prev.timestamp).getTime();

    const isSameType = log.type === prev.type;
    const isSameTitle = (log.title || '').trim().toLowerCase() === (prev.title || '').trim().toLowerCase();
    const isSameUserOrIp =
      (log.userId && log.userId === prev.userId) ||
      (log.ip && log.ip === prev.ip) ||
      (!log.userId && !prev.userId);

    const isCloseInTime = Math.abs(prevTime - logTime) <= DEDUP_WINDOW_MS;

    if (isSameType && isSameTitle && isSameUserOrIp && isCloseInTime) {
      prev.count = (prev.count || 1) + (log.count || 1);
      if (logTime > prevTime) {
        prev.timestamp = log.timestamp;
        prev.formattedDate = log.formattedDate;
      }
    } else {
      result.push({ ...log, count: log.count || 1 });
    }
  }

  return result;
}

/**
 * Writes a log item to Firestore and local storage, compressing duplicate entries within a 15-min window.
 */
export async function writeSystemLog(log: Omit<SystemLogItem, 'id' | 'timestamp' | 'formattedDate'> & { id?: string; timestamp?: string }): Promise<SystemLogItem> {
  const now = new Date();
  const nowMs = now.getTime();
  const cutoffTime = nowMs - DEDUP_WINDOW_MS;

  const localLogs = getLocalLogs();
  const existing = localLogs.find((item) => {
    const t = new Date(item.timestamp).getTime();
    if (isNaN(t) || t < cutoffTime) return false;
    const isSameType = item.type === log.type;
    const isSameTitle = (item.title || '').trim().toLowerCase() === (log.title || '').trim().toLowerCase();
    const isSameUserOrIp =
      (log.userId && log.userId === item.userId) ||
      (log.ip && log.ip === item.ip) ||
      (!log.userId && !item.userId);
    return isSameType && isSameTitle && isSameUserOrIp;
  });

  let fullLog: SystemLogItem;

  if (existing) {
    fullLog = {
      ...existing,
      count: (existing.count || 1) + 1,
      timestamp: now.toISOString(),
      formattedDate: now.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      message: log.message || existing.message,
      metadata: { ...existing.metadata, ...log.metadata }
    };
  } else {
    fullLog = {
      id: log.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || now.toISOString(),
      formattedDate: now.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      count: 1,
      ...log
    };
  }

  // Always save locally first
  saveLogToLocal(fullLog);

  // Then persist to Firestore
  try {
    const cleaned = cleanFirestoreData(fullLog);
    const docRef = doc(db, 'system_logs', fullLog.id);
    await setDoc(docRef, cleaned);

    // Periodically clean up logs older than 24h
    if (Math.random() < 0.2) {
      cleanUpOldLogsFromFirestore().catch(() => {});
    }
  } catch (err) {
    if (!isQuotaExhaustedError(err)) {
      console.warn('Could not persist log to Firestore:', err);
    }
  }

  return fullLog;
}

/**
 * Logs a client-side error (e.g. JS runtime error, checkout issue, image load failure).
 */
export async function logClientError(
  error: Error | string,
  source: string = 'ClientRuntime',
  extra?: Record<string, any>
): Promise<SystemLogItem | null> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Immediately discard ignorable browser noise (aborts, websocket reloads, etc.)
  if (isIgnorableClientError(message, stack)) {
    return null;
  }

  const deviceInfo = getClientDeviceInfo();
  const url = typeof window !== 'undefined' ? window.location.href : '';

  return writeSystemLog({
    type: 'client_error',
    level: 'error',
    title: `Lỗi: ${message.slice(0, 80)}`,
    message,
    stack,
    source,
    url,
    userAgent: deviceInfo.userAgent,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    metadata: extra
  });
}

/**
 * Logs an Admin Login attempt with IP and Geo details.
 */
export async function logAdminLogin(data: {
  username: string;
  name?: string;
  isRoot?: boolean;
  status: 'success' | 'blocked_geo' | 'failed_password';
  reason?: string;
  customGeo?: any;
}): Promise<SystemLogItem> {
  const deviceInfo = getClientDeviceInfo();
  let geo = data.customGeo;

  if (!geo) {
    try {
      geo = await getClientGeoLocation();
    } catch {
      geo = { ip: 'Unknown', country: 'Vietnam', countryCode: 'VN', isVietnam: true };
    }
  }

  let level: LogLevel = 'info';
  let title = `Admin đăng nhập thành công: ${data.username}`;

  if (data.status === 'blocked_geo') {
    level = 'warning';
    title = `Chặn đăng nhập IP ngoại quốc (${geo.countryCode}): ${data.username}`;
  } else if (data.status === 'failed_password') {
    level = 'warning';
    title = `Đăng nhập thất bại (Sai mật khẩu): ${data.username}`;
  }

  const message = data.reason || (
    data.status === 'success'
      ? `Tài khoản ${data.name || data.username} đăng nhập thành công từ ${geo.city ? geo.city + ', ' : ''}${geo.country} (IP: ${geo.ip})`
      : data.status === 'blocked_geo'
      ? `Truy cập từ ${geo.country} (${geo.countryCode} - IP: ${geo.ip}) bị chặn do không thuộc Việt Nam`
      : `Đăng nhập sai mật khẩu tài khoản ${data.username} từ IP ${geo.ip}`
  );

  return writeSystemLog({
    type: 'admin_login',
    level,
    title,
    message,
    source: 'AdminAuth',
    userName: data.name || data.username,
    userId: data.username,
    status: data.status,
    ip: geo.ip,
    country: geo.country,
    countryCode: geo.countryCode,
    city: geo.city,
    region: geo.region,
    isp: geo.isp,
    userAgent: deviceInfo.userAgent,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    metadata: {
      isRoot: data.isRoot,
      timezone: geo.timezone,
      latitude: geo.latitude,
      longitude: geo.longitude
    }
  });
}

/**
 * Logs system activity (e.g. inventory update, banner edit, backup restored).
 */
export async function logSystemActivity(
  title: string,
  message: string,
  source: string = 'AdminActivity',
  extra?: Record<string, any>
): Promise<SystemLogItem> {
  const deviceInfo = getClientDeviceInfo();
  return writeSystemLog({
    type: 'system_activity',
    level: 'info',
    title,
    message,
    source,
    userAgent: deviceInfo.userAgent,
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    metadata: extra
  });
}

/**
 * Fetches all system logs from Firestore (merged with local logs).
 */
export async function fetchSystemLogsFromFirestore(limitCount: number = 100): Promise<SystemLogItem[]> {
  try {
    const q = query(
      collection(db, 'system_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    const cloudLogs: SystemLogItem[] = snapshot.docs.map((docSnap) => docSnap.data() as SystemLogItem);
    
    // Merge with local logs to ensure nothing is missed
    const localLogs = getLocalLogs();
    const map = new Map<string, SystemLogItem>();
    
    cloudLogs.forEach((l) => map.set(l.id, l));
    localLogs.forEach((l) => {
      if (!map.has(l.id)) {
        map.set(l.id, l);
      }
    });

    const combined = Array.from(map.values());
    const compressed = compressAndFilterLogs(combined);

    // Trigger background cleanup of expired logs
    cleanUpOldLogsFromFirestore().catch(() => {});

    return compressed.slice(0, limitCount);
  } catch (err) {
    console.warn('Error fetching system logs, returning local fallback:', err);
    return compressAndFilterLogs(getLocalLogs());
  }
}

/**
 * Subscribes to real-time system logs.
 */
export function subscribeToSystemLogs(
  onUpdate: (logs: SystemLogItem[]) => void,
  limitCount: number = 100
): () => void {
  // If not authenticated with Firebase Auth, return local logs immediately and do not open a forbidden cloud stream
  if (!auth.currentUser) {
    onUpdate(compressAndFilterLogs(getLocalLogs()));
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'system_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const cloudLogs: SystemLogItem[] = snapshot.docs.map((docSnap) => docSnap.data() as SystemLogItem);
        const localLogs = getLocalLogs();
        const map = new Map<string, SystemLogItem>();
        
        cloudLogs.forEach((l) => map.set(l.id, l));
        localLogs.forEach((l) => {
          if (!map.has(l.id)) {
            map.set(l.id, l);
          }
        });

        const combined = Array.from(map.values());
        const compressed = compressAndFilterLogs(combined);

        onUpdate(compressed.slice(0, limitCount));
      },
      (err: any) => {
        if (err?.code !== 'permission-denied') {
          console.warn('Logs subscription error:', err);
        }
        onUpdate(compressAndFilterLogs(getLocalLogs()));
      }
    );
  } catch {
    onUpdate(compressAndFilterLogs(getLocalLogs()));
    return () => {};
  }
}

/**
 * Deletes a single system log.
 */
export async function deleteSystemLogFromFirestore(logId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'system_logs', logId));
  } catch (err) {
    console.warn('Error deleting log from Firestore:', err);
  }

  // Also remove from local storage
  try {
    const local = getLocalLogs().filter((l) => l.id !== logId);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(local));
  } catch {}
}

/**
 * Clears all system logs.
 */
export async function clearAllSystemLogsFromFirestore(): Promise<void> {
  try {
    const snapshot = await getDocs(query(collection(db, 'system_logs'), limit(200)));
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Error clearing Firestore logs:', err);
  }

  try {
    localStorage.removeItem(LOCAL_STORAGE_LOGS_KEY);
  } catch {}
}

/**
 * Initializes global error listeners to auto-capture client crashes during shopping/browsing.
 */
let isGlobalErrorLoggingInitialized = false;

export function initGlobalErrorLogging() {
  if (typeof window === 'undefined' || isGlobalErrorLoggingInitialized) return;
  isGlobalErrorLoggingInitialized = true;

  window.addEventListener('error', (event) => {
    const error = event.error || event.message || 'Window Error';
    const message = typeof error === 'string' ? error : error.message || '';
    if (isIgnorableClientError(message, error instanceof Error ? error.stack : undefined)) {
      return;
    }
    logClientError(
      error,
      'WindowErrorHandler',
      { filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || '');
    if (isIgnorableClientError(message, reason instanceof Error ? reason.stack : undefined)) {
      return;
    }
    logClientError(
      reason instanceof Error ? reason : message || 'Unhandled Promise Rejection',
      'UnhandledPromiseRejection'
    );
  });
}
