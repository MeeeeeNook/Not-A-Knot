import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { AccountActivityDrawer } from './AccountActivityDrawer';
import type { SellerUser } from '../../types';
import { affiliateActivityLabels, affiliateTabLabels, mergeAffiliateActivity } from '../../utils/affiliateActivity';

export function AffiliateAccountActivity({ seller, name, email, onClose }: { seller?: SellerUser; name: string; email: string; onClose: () => void }) {
  const [profile, setProfile] = useState(seller);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(seller?.id));
  useEffect(() => {
    setProfile(seller); setError(''); setLoading(Boolean(seller?.id));
    if (!seller?.id) return;
    return onSnapshot(doc(db, 'sellers', seller.id), snapshot => {
      if (snapshot.exists()) setProfile({ ...seller, ...snapshot.data(), id: seller.id });
      else { setProfile(undefined); setError('Tài khoản này không còn tồn tại.'); }
      setLoading(false);
    }, () => { setError('Chưa tải được lịch sử mới nhất. Vui lòng đóng và mở lại để thử lại.'); setLoading(false); });
  }, [seller?.id]);
  const history = mergeAffiliateActivity(profile?.affiliateActivity);
  return <AccountActivityDrawer name={name} email={email} createdAt={profile?.createdAt} lastLoginAt={profile?.lastLoginAt} ip={profile?.lastLoginIp} device={profile?.lastDevice} entries={history.map(entry => ({ ...entry, title: `${affiliateActivityLabels[entry.action]}${entry.tab ? ` · ${affiliateTabLabels[entry.tab] || entry.tab}` : ''}`, kind: entry.action === 'login' || entry.action === 'logout' ? 'login' : 'activity' }))} loading={loading} error={error} note="Tối đa 100 hoạt động gần nhất." onClose={onClose} />;
}
