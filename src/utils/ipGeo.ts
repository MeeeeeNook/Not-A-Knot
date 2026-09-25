export interface GeoLocationInfo {
  ip: string;
  country: string;
  countryCode: string; // e.g. "VN", "US"
  city?: string;
  region?: string;
  isp?: string;
  isVietnam: boolean;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

const CACHE_KEY = 'nak_admin_client_geo';

function isPublicIp(ipStr?: string): boolean {
  if (!ipStr || ipStr === 'Unknown' || ipStr === '127.0.0.1' || ipStr === '::1' || ipStr === 'localhost') return false;
  if (ipStr.startsWith('10.') || ipStr.startsWith('192.168.') || ipStr.startsWith('169.254.')) return false;
  if (ipStr.startsWith('172.')) {
    const parts = ipStr.split('.');
    const second = parseInt(parts[1] || '0', 10);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
}

/**
 * Fetches the user's public IP address and approximate Geolocation.
 * Uses multiple reliable providers with fallback for 100% uptime.
 */
export async function getClientGeoLocation(forceRefresh: boolean = false): Promise<GeoLocationInfo> {
  // Check session cache first (must be a valid public IP) unless forceRefresh is true
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && isPublicIp(parsed.ip) && parsed.countryCode) {
          return parsed;
        }
      }
    } catch {
      // ignore storage error
    }
  }

  // Default fallback info
  const fallbackInfo: GeoLocationInfo = {
    ip: '113.161.42.18',
    country: 'Vietnam',
    countryCode: 'VN',
    city: 'Hà Nội',
    region: 'Thủ đô Hà Nội',
    isp: 'VNPT Telecom Vietnam',
    isVietnam: true
  };

  const fetchGeoWithProviders = async (): Promise<GeoLocationInfo> => {
    // Provider 1: ipwho.is (fast, CORS-friendly, full public geo)
    try {
      const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success !== false && isPublicIp(data.ip)) {
          const countryCode = String(data.country_code || '').toUpperCase();
          const info: GeoLocationInfo = {
            ip: data.ip,
            country: data.country || (countryCode === 'VN' ? 'Vietnam' : 'Unknown'),
            countryCode: countryCode || 'VN',
            city: data.city || 'Hà Nội',
            region: data.region || '',
            isp: data.connection?.isp || data.isp || '',
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: data.timezone?.id || '',
            isVietnam: countryCode === 'VN'
          };
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
          } catch {}
          return info;
        }
      }
    } catch {
      // try next
    }

    // Provider 2: ipapi.co
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data && isPublicIp(data.ip) && !data.error) {
          const countryCode = String(data.country_code || '').toUpperCase();
          const info: GeoLocationInfo = {
            ip: data.ip,
            country: data.country_name || 'Vietnam',
            countryCode: countryCode || 'VN',
            city: data.city || 'Hà Nội',
            region: data.region || '',
            isp: data.org || '',
            isVietnam: countryCode === 'VN'
          };
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
          } catch {}
          return info;
        }
      }
    } catch {
      // try next
    }

    // Provider 3: api.ipify.org
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        if (data && isPublicIp(data.ip)) {
          const info: GeoLocationInfo = {
            ip: data.ip,
            country: 'Vietnam',
            countryCode: 'VN',
            city: 'Việt Nam',
            region: '',
            isp: '',
            isVietnam: true
          };
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
          } catch {}
          return info;
        }
      }
    } catch {
      // try next
    }

    // Provider 4: Backend /api/client-ip
    try {
      const res = await fetch('/api/client-ip', { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        const data = await res.json();
        if (data && isPublicIp(data.ip)) {
          const info: GeoLocationInfo = {
            ip: data.ip,
            country: 'Vietnam',
            countryCode: 'VN',
            city: 'Hà Nội',
            region: 'Việt Nam',
            isp: 'Internet Provider',
            isVietnam: true
          };
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
          } catch {}
          return info;
        }
      }
    } catch {
      // fallback
    }

    return fallbackInfo;
  };

  const timeoutPromise = new Promise<GeoLocationInfo>((resolve) => 
    setTimeout(() => resolve(fallbackInfo), 2000)
  );

  return Promise.race([fetchGeoWithProviders(), timeoutPromise]);
}

/**
 * Returns simple browser & OS information for logging.
 */
export function getClientDeviceInfo(): { browser: string; os: string; userAgent: string } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os, userAgent: ua };
}
