import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, cleanFirestoreData, isQuotaExhaustedError } from '../firebase';
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
 * Purges Firestore and local storage log entries older than 30 days.
 */
export async function cleanUpOldLogsFromFirestore(): Promise<void> {
  const cutoffTime = Date.now() - LOG_RETENTION_MS;

  // Clean local storage
  try {
    const local = getLocalLogs().filter((l) => {
      const t = new Date(l.timestamp).getTime();
      return !isNaN(t) && t >= cutoffTime;
    });
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(local));
  } catch {}

  // Clean Firestore system_logs (only items older than 30 days)
  try {
    const snapshot = await getDocs(query(collection(db, 'system_logs'), limit(150)));
    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const t = new Date(data.timestamp || 0).getTime();
      // Keep admin_login logs longer, only delete if older than cutoffTime
      if (isNaN(t) || t < cutoffTime) {
        batch.delete(docSnap.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`[SystemLog] Cleaned ${count} expired log items older than 30 days.`);
    }
  } catch (err) {
    if (!isQuotaExhaustedError(err)) {
      console.warn('Could not clean old logs from Firestore:', err);
    }
  }
}

/**
 * Filters out logs older than 30 days and compresses consecutive / similar adjacent logs into single entries.
 */
export function compressAndFilterLogs(rawLogs: SystemLogItem[]): SystemLogItem[] {
  const cutoffTime = Date.now() - LOG_RETENTION_MS;

  // 1. Filter out logs older than 30 days
  const validLogs = rawLogs.filter((l) => {
    const t = new Date(l.timestamp).getTime();
    return !isNaN(t) && t >= cutoffTime;
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
): Promise<SystemLogItem> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
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
      (err) => {
        console.warn('Logs subscription error:', err);
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
    // Ignore benign cross-origin script error noise or react HMR websocket noise
    if (event.message?.includes('ResizeObserver') || event.message?.includes('Script error.')) {
      return;
    }
    logClientError(
      event.error || event.message || 'Window Error',
      'WindowErrorHandler',
      { filename: event.filename, lineno: event.lineno, colno: event.colno }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && typeof reason === 'object' && reason.message?.includes('ResizeObserver')) {
      return;
    }
    logClientError(
      reason instanceof Error ? reason : String(reason || 'Unhandled Promise Rejection'),
      'UnhandledPromiseRejection'
    );
  });
}
