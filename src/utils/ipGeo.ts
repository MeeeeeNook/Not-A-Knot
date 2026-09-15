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

/**
 * Fetches the user's public IP address and approximate Geolocation.
 * Uses multiple reliable providers with fallback for 100% uptime.
 */
export async function getClientGeoLocation(): Promise<GeoLocationInfo> {
  // Check session cache first
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.ip && parsed.countryCode) {
        return parsed;
      }
    }
  } catch {
    // ignore storage error
  }

  // Provider 1: ipwho.is (fast, CORS-friendly, no key required)
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success !== false && (data.country_code || data.ip)) {
        const countryCode = String(data.country_code || '').toUpperCase();
        const info: GeoLocationInfo = {
          ip: data.ip || 'Unknown',
          country: data.country || (countryCode === 'VN' ? 'Vietnam' : 'Unknown'),
          countryCode: countryCode || 'VN',
          city: data.city || '',
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
    // fallback to provider 2
  }

  // Provider 2: ipapi.co
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.country_code || data.ip)) {
        const countryCode = String(data.country_code || data.country || '').toUpperCase();
        const info: GeoLocationInfo = {
          ip: data.ip || 'Unknown',
          country: data.country_name || (countryCode === 'VN' ? 'Vietnam' : 'Unknown'),
          countryCode: countryCode || 'VN',
          city: data.city || '',
          region: data.region || '',
          isp: data.org || '',
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone || '',
          isVietnam: countryCode === 'VN'
        };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(info));
        } catch {}
        return info;
      }
    }
  } catch {
    // fallback to provider 3
  }

  // Provider 3: freeipapi.com
  try {
    const res = await fetch('https://freeipapi.com/api/json', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.countryCode || data.ipAddress)) {
        const countryCode = String(data.countryCode || '').toUpperCase();
        const info: GeoLocationInfo = {
          ip: data.ipAddress || 'Unknown',
          country: data.countryName || (countryCode === 'VN' ? 'Vietnam' : 'Unknown'),
          countryCode: countryCode || 'VN',
          city: data.cityName || '',
          region: data.regionName || '',
          isp: '',
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timeZone || '',
          isVietnam: countryCode === 'VN'
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

  // Default fallback: Local / Vietnam assumption
  const fallbackInfo: GeoLocationInfo = {
    ip: '127.0.0.1 (Local/Fallback)',
    country: 'Vietnam',
    countryCode: 'VN',
    city: 'Hà Nội',
    region: 'Thủ đô Hà Nội',
    isp: 'Local Network',
    isVietnam: true
  };

  return fallbackInfo;
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
