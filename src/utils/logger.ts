import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy, limit, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, cleanFirestoreData, isQuotaExhaustedError } from '../firebase';
import { SystemLogItem, LogType, LogLevel } from '../types';
import { getClientGeoLocation, getClientDeviceInfo } from './ipGeo';

const LOCAL_STORAGE_LOGS_KEY = 'nak_system_logs_local';
const MAX_LOCAL_LOGS = 150;

/**
 * Saves a log to local storage as fallback and for offline retrieval.
 */
function saveLogToLocal(log: SystemLogItem) {
  try {
    const existing: SystemLogItem[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
    const updated = [log, ...existing.filter((item) => item.id !== log.id)].slice(0, MAX_LOCAL_LOGS);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

/**
 * Retrieves local fallback logs.
 */
export function getLocalLogs(): SystemLogItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_LOGS_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Writes a log item to Firestore and local storage.
 */
export async function writeSystemLog(log: Omit<SystemLogItem, 'id' | 'timestamp' | 'formattedDate'> & { id?: string; timestamp?: string }): Promise<SystemLogItem> {
  const now = new Date();
  const fullLog: SystemLogItem = {
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
    ...log
  };

  // Always save locally first
  saveLogToLocal(fullLog);

  // Then persist to Firestore
  try {
    const cleaned = cleanFirestoreData(fullLog);
    const docRef = doc(db, 'system_logs', fullLog.id);
    await setDoc(docRef, cleaned);
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

    const combined = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return combined.slice(0, limitCount);
  } catch (err) {
    console.warn('Error fetching system logs, returning local fallback:', err);
    return getLocalLogs();
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

        const combined = Array.from(map.values()).sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        onUpdate(combined.slice(0, limitCount));
      },
      (err) => {
        console.warn('Logs subscription error:', err);
        onUpdate(getLocalLogs());
      }
    );
  } catch {
    onUpdate(getLocalLogs());
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
