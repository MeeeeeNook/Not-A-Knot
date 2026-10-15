import { useCallback, useEffect, useRef } from 'react';
import type { AffiliateActivityAction, SellerUser } from '../types';
import { recordAffiliateActivity, recordRecentAffiliateLogin } from '../utils/affiliateActivityClient';

export function useAffiliateActivity(seller: SellerUser | null, tab: string, preview: boolean) {
  const lastView = useRef('');
  const enabled = Boolean(!preview && seller?.role === 'affiliate');
  const track = useCallback((action: AffiliateActivityAction) => enabled ? recordAffiliateActivity(seller, action, tab) : Promise.resolve(), [enabled, seller?.id, tab]);
  useEffect(() => {
    if (!enabled) { lastView.current = ''; return; }
    const key = `${seller!.id}:${tab}`;
    if (lastView.current === key) return;
    const isFirst = !lastView.current.startsWith(`${seller!.id}:`);
    lastView.current = key;
    if (isFirst) recordRecentAffiliateLogin(seller);
    void track(isFirst ? 'hub_open' : 'tab_view');
  }, [enabled, seller?.id, tab, track]);
  return track;
}
