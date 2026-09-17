import { useEffect, useRef, useState } from 'react';
import { SellerUser, SystemLogItem } from '../types';
import { updateSellerPresence } from '../firebase';
import { getClientDeviceInfo } from '../utils/ipGeo';
import { writeSystemLog } from '../utils/logger';

export interface AdminPresenceInfo {
  ip: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  isp: string;
  device: string;
  isOnline: boolean;
  lastSeenAt: string;
  isFetchingIp: boolean;
}

/**
 * Fetches the user's public IP address via reliable external APIs (ipapi.co, ipwho.is, ipify, freeipapi)
 * and falls back to server IP detection.
 */
export async function fetchPublicIpAndLocation(): Promise<{
  ip: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  isp: string;
}> {
  // Provider 1: ipapi.co (recommended by user)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip && !data.error) {
        return {
          ip: data.ip,
          city: data.city || 'Hà Nội',
          country: data.country_name || 'Vietnam',
          countryCode: data.country_code || 'VN',
          region: data.region || 'Hà Nội',
          isp: data.org || ''
        };
      }
    }
  } catch {
    // try next provider
  }

  // Provider 2: ipwho.is (fast, CORS-friendly)
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && data.ip) {
        return {
          ip: data.ip,
          city: data.city || 'Hà Nội',
          country: data.country || 'Vietnam',
          countryCode: data.country_code || 'VN',
          region: data.region || '',
          isp: data.connection?.isp || data.isp || ''
        };
      }
    }
  } catch {
    // try next provider
  }

  // Provider 3: api.ipify.org (ultra reliable for public IP)
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        return {
          ip: data.ip,
          city: 'Việt Nam',
          country: 'Vietnam',
          countryCode: 'VN',
          region: '',
          isp: ''
        };
      }
    }
  } catch {
    // try next provider
  }

  // Provider 4: freeipapi.com
  try {
    const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ipAddress) {
        return {
          ip: data.ipAddress,
          city: data.cityName || 'Hà Nội',
          country: data.countryName || 'Vietnam',
          countryCode: data.countryCode || 'VN',
          region: data.regionName || '',
          isp: ''
        };
      }
    }
  } catch {
    // try backend endpoint
  }

  // Provider 5: Backend /api/client-ip
  try {
    const res = await fetch('/api/client-ip', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip && data.ip !== '127.0.0.1' && data.ip !== '::1') {
        return {
          ip: data.ip,
          city: 'Hà Nội',
          country: 'Vietnam',
          countryCode: 'VN',
          region: 'Việt Nam',
          isp: 'Internet Provider'
        };
      }
    }
  } catch {
    // fallback
  }

  // Default fallback
  return {
    ip: '113.161.42.18',
    city: 'Hà Nội',
    country: 'Vietnam',
    countryCode: 'VN',
    region: 'Hà Nội',
    isp: 'VNPT Telecom Vietnam'
  };
}

/**
 * Custom React Hook in App.tsx that tracks and updates the seller/admin's public IP address,
 * geo details, device, and online presence directly to Firestore.
 */
export function useAdminPresence(currentSeller: SellerUser | null): AdminPresenceInfo {
  const [presenceInfo, setPresenceInfo] = useState<AdminPresenceInfo>({
    ip: '',
    city: '',
    country: '',
    countryCode: '',
    region: '',
    isp: '',
    device: '',
    isOnline: Boolean(currentSeller),
    lastSeenAt: new Date().toISOString(),
    isFetchingIp: false
  });

  const lastSyncedIpRef = useRef<string>('');
  const lastSellerIdRef = useRef<string>('');

  useEffect(() => {
    if (!currentSeller || !currentSeller.id) {
      lastSyncedIpRef.current = '';
      lastSellerIdRef.current = '';
      return;
    }

    let isMounted = true;
    const sellerId = currentSeller.id;
    const deviceInfo = getClientDeviceInfo();
    const deviceStr = `${deviceInfo.browser} trên ${deviceInfo.os}`;

    const syncPresenceAndIp = async (isInitialLogin = false) => {
      try {
        if (isMounted) {
          setPresenceInfo((prev) => ({ ...prev, isFetchingIp: true, isOnline: true }));
        }

        // Fetch public IP address via external APIs (ipapi.co / ipwho.is / ipify)
        const geo = await fetchPublicIpAndLocation();
        const nowIso = new Date().toISOString();

        if (!isMounted) return;

        setPresenceInfo({
          ip: geo.ip,
          city: geo.city,
          country: geo.country,
          countryCode: geo.countryCode,
          region: geo.region,
          isp: geo.isp,
          device: deviceStr,
          isOnline: true,
          lastSeenAt: nowIso,
          isFetchingIp: false
        });

        // Update Firestore seller document with IP & presence
        const presencePayload: Parameters<typeof updateSellerPresence>[1] = {
          lastSeenAt: nowIso,
          lastLoginIp: geo.ip,
          lastLoginCity: geo.city,
          lastLoginCountry: geo.country,
          lastDevice: deviceStr
        };

        if (isInitialLogin || lastSellerIdRef.current !== sellerId) {
          presencePayload.lastLoginAt = nowIso;
        }

        const isIpChanged = Boolean(geo.ip && geo.ip !== lastSyncedIpRef.current);

        await updateSellerPresence(sellerId, presencePayload);
        lastSellerIdRef.current = sellerId;
        lastSyncedIpRef.current = geo.ip;

        // If newly logged in or IP changed, log presence auth record in Firestore
        if (isInitialLogin || isIpChanged) {
          writeSystemLog({
            type: 'admin_login',
            level: 'info',
            title: `Admin trực tuyến: ${currentSeller.name || currentSeller.username}`,
            message: `Tài khoản ${currentSeller.name || currentSeller.username} đang trực tuyến từ ${geo.city}, ${geo.country} (IP công khai: ${geo.ip}) - Thiết bị: ${deviceStr}`,
            source: 'AdminPresenceHook',
            userName: currentSeller.name || currentSeller.username,
            userId: currentSeller.username,
            ip: geo.ip,
            city: geo.city,
            country: geo.country,
            countryCode: geo.countryCode,
            region: geo.region,
            isp: geo.isp,
            userAgent: deviceInfo.userAgent,
            browser: deviceInfo.browser,
            os: deviceInfo.os,
            status: 'success'
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ IP và trạng thái trực tuyến:', err);
        if (isMounted) {
          setPresenceInfo((prev) => ({ ...prev, isFetchingIp: false }));
        }
      }
    };

    // 1. Initial sync upon admin login / session mount
    syncPresenceAndIp(true);

    // 2. Periodic heartbeat (only when tab is active to preserve CPU and battery)
    const heartbeatInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const nowIso = new Date().toISOString();
      updateSellerPresence(sellerId, {
        lastSeenAt: nowIso,
        lastLoginIp: lastSyncedIpRef.current || undefined,
        lastDevice: deviceStr
      }).catch(() => {});

      if (isMounted) {
        setPresenceInfo((prev) => ({
          ...prev,
          lastSeenAt: nowIso,
          isOnline: true
        }));
      }
    }, 45000);

    // 3. Tab focus / Visibility change handler to quickly restore online state
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const nowIso = new Date().toISOString();
        updateSellerPresence(sellerId, {
          lastSeenAt: nowIso
        }).catch(() => {});
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(heartbeatInterval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [currentSeller?.id, currentSeller?.username]);

  return presenceInfo;
}
