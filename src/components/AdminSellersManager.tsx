import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, Key, ShieldCheck, UserCheck, UserX, Trash2, Edit2, 
  Search, Check, Eye, EyeOff, AlertTriangle, Phone, 
  TrendingUp, ShoppingBag, ShieldAlert, X, Sparkles, RefreshCw,
  Globe, MapPin, Clock, Laptop, Smartphone, CheckCircle2, XCircle, History, Copy,
  LayoutGrid, Table as TableIcon, PhoneCall, ChevronDown
} from 'lucide-react';
import { Lock } from './common/LockIcon';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { SellerUser, SystemLogItem, AuthorizedSellerItem, UnauthorizedLoginAttemptItem } from '../types';
import { 
  db, 
  firebaseConfig, 
  StoredOrder, 
  saveSellerToFirestore, 
  deleteSellerFromFirestore, 
  updateSellerPresence, 
  fetchAuthorizedSellersFromFirestore, 
  saveAuthorizedSellerToFirestore, 
  deleteAuthorizedSellerFromFirestore,
  fetchUnauthorizedLoginAttemptsFromFirestore,
  deleteUnauthorizedLoginAttemptFromFirestore,
  clearAllUnauthorizedLoginAttemptsFromFirestore
} from '../firebase';
import { 
  hashPassword, 
  generateSalt, 
  ROOT_ADMIN_USERNAME, 
  deduplicateSellers, 
  hashUsername, 
  isRootAdminUser, 
  isRootAdminUsername, 
  verifyAdminAction,
  refreshAdminSession,
  canChangeUserPassword,
  linkGoogleAccountWithSeller,
  unlinkGoogleAccountFromSeller,
  AUTHORIZED_ROOT_ADMIN_EMAILS,
  getRootAdminEmails
} from '../utils/auth';
import { fetchSystemLogsFromFirestore, subscribeToSystemLogs, logAdminLogin } from '../utils/logger';

interface AdminSellersManagerProps {
  sellers: SellerUser[];
  orders: StoredOrder[];
  currentAdmin: SellerUser | null;
  onUpdateSellers: (newSellers: SellerUser[]) => void;
  onUpdateCurrentAdmin?: (updatedAdmin: SellerUser) => void;
}

// Helper to convert 2-letter ISO country code or country name to flag emoji
function getCountryFlagEmoji(countryCode?: string, countryName?: string): string {
  let code = (countryCode || '').trim().toUpperCase();
  
  if (!code && countryName) {
    const cLower = countryName.toLowerCase();
    if (cLower.includes('netherland') || cLower.includes('hà lan') || cLower.includes('amsterdam') || cLower.includes(' noord-holland') || cLower.includes('nl')) {
      code = 'NL';
    } else if (cLower.includes('vietnam') || cLower.includes('việt nam')) {
      code = 'VN';
    } else if (cLower.includes('united states') || cLower.includes('mỹ') || cLower.includes('usa')) {
      code = 'US';
    } else if (cLower.includes('japan') || cLower.includes('nhật')) {
      code = 'JP';
    } else if (cLower.includes('germany') || cLower.includes('đức')) {
      code = 'DE';
    } else if (cLower.includes('france') || cLower.includes('pháp')) {
      code = 'FR';
    }
  }

  if (!code || code.length !== 2) return '🌐';

  // Convert 2-letter country code into regional indicator symbol flags
  const codePoints = code
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Helper to determine accurate seller presence and latest IP
function getSellerPresenceInfo(seller: SellerUser, logs: SystemLogItem[]) {
  const now = Date.now();
  const lastSeenMs = seller.lastSeenAt ? new Date(seller.lastSeenAt).getTime() : 0;
  // Consider online if seen within the last 3 minutes (180000ms)
  const isOnline = Boolean(lastSeenMs && (now - lastSeenMs < 180000));

  let lastSeenText = 'Chưa đăng nhập';
  if (lastSeenMs) {
    const diffMinutes = Math.floor((now - lastSeenMs) / 60000);
    if (diffMinutes < 1) {
      lastSeenText = 'Vừa xong';
    } else if (diffMinutes < 60) {
      lastSeenText = `${diffMinutes} phút trước`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      lastSeenText = `${hours} giờ trước`;
    } else {
      lastSeenText = new Date(lastSeenMs).toLocaleDateString('vi-VN');
    }
  }

  // Find latest IP from seller document or recent login logs
  let latestIp = seller.lastLoginIp;
  let countryName = seller.lastLoginCountry || 'Việt Nam';
  let countryCode = seller.lastLoginCountryCode || (countryName.toLowerCase().includes('netherland') ? 'NL' : 'VN');
  let location = seller.lastLoginCity ? `${seller.lastLoginCity}, ${countryName}` : '';

  if (!latestIp) {
    const uName = (seller.username || '').toLowerCase();
    const userLog = logs.find((l) => 
      l.type === 'admin_login' && 
      ((l.userId || '').toLowerCase() === uName || (l.userName || '').toLowerCase() === uName || (l.message || '').toLowerCase().includes(uName)) &&
      l.ip
    );
    if (userLog && userLog.ip) {
      latestIp = userLog.ip;
      countryName = userLog.country || 'Việt Nam';
      countryCode = userLog.countryCode || (countryName.toLowerCase().includes('netherland') ? 'NL' : 'VN');
      if (userLog.city) {
        location = `${userLog.city}, ${countryName}`;
      }
    }
  }

  if (!latestIp) {
    latestIp = 'Chưa ghi nhận IP';
    location = 'Chưa có vị trí';
  }

  return { isOnline, lastSeenText, latestIp, location, countryCode, countryName };
}

export const AdminSellersManager: React.FC<AdminSellersManagerProps> = ({
  sellers,
  orders,
  currentAdmin,
  onUpdateSellers,
  onUpdateCurrentAdmin
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'root_admin' | 'deputy_admin' | 'member'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Mobile / Desktop View Mode (Card vs Table)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  });

  // Member Login Logs Drawer / Modal State
  const [selectedSellerForLogs, setSelectedSellerForLogs] = useState<SellerUser | null>(null);
  const [allLogs, setAllLogs] = useState<SystemLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [copiedLogIp, setCopiedLogIp] = useState<string | null>(null);
  const [testLoginLogMessage, setTestLoginLogMessage] = useState<string | null>(null);

  // Subscribe to real-time system logs for admin login history
  useEffect(() => {
    const unsub = subscribeToSystemLogs((logs) => {
      setAllLogs(logs);
    }, 200);
    return () => unsub();
  }, []);

  // Inline action states
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [passwordTargetSellerId, setPasswordTargetSellerId] = useState<string | null>(null);
  const [deletingSellerId, setDeletingSellerId] = useState<string | null>(null);
  const [promotingSellerId, setPromotingSellerId] = useState<string | null>(null);
  const [demotingSellerId, setDemotingSellerId] = useState<string | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    googleEmail: '',
    role: 'member' as 'root_admin' | 'deputy_admin' | 'member',
    isActive: true
  });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  // Authorized Google Emails State & Handlers
  const [authorizedEmails, setAuthorizedEmails] = useState<AuthorizedSellerItem[]>([]);
  const [isLoadingAuthEmails, setIsLoadingAuthEmails] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [newNameInput, setNewNameInput] = useState('');
  const [newRoleInput, setNewRoleInput] = useState<'deputy_admin' | 'member'>('member');
  const [authEmailError, setAuthEmailError] = useState('');
  const [authEmailSuccess, setAuthEmailSuccess] = useState('');
  const [isSubmittingAuthEmail, setIsSubmittingAuthEmail] = useState(false);

  // Unauthorized Login Attempts Log State
  const [unauthorizedAttempts, setUnauthorizedAttempts] = useState<UnauthorizedLoginAttemptItem[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
  const [attemptSuccessMsg, setAttemptSuccessMsg] = useState('');

  // Editable display names for Root Admins (Tổng bí thư)
  const [adminCustomNames, setAdminCustomNames] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('nak_admin_custom_names');
      if (stored) return JSON.parse(stored);
    } catch {}
    const rootEmails = getRootAdminEmails();
    const initialNames: Record<string, string> = {};
    rootEmails.forEach((email, idx) => {
      if (email) {
        if (currentAdmin?.name && (currentAdmin.googleEmail === email || idx === 0)) {
          initialNames[email] = currentAdmin.name;
        } else {
          initialNames[email] = idx === 0 ? 'Tổng bí thư' : `Tổng bí thư ${idx + 1}`;
        }
      }
    });
    return initialNames;
  });

  // Modal / Inline Rename State for Tổng bí thư
  const [editingTarget, setEditingTarget] = useState<{
    email: string;
    currentName: string;
    isRoot: boolean;
    role?: 'deputy_admin' | 'member';
  } | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editRoleValue, setEditRoleValue] = useState<'deputy_admin' | 'member'>('member');

  // Load authorized emails from Firestore
  const loadAuthorizedEmails = async () => {
    try {
      setIsLoadingAuthEmails(true);
      const list = await fetchAuthorizedSellersFromFirestore();
      setAuthorizedEmails(list);
    } catch (e) {
      console.warn('Lỗi tải danh sách email ủy quyền:', e);
    } finally {
      setIsLoadingAuthEmails(false);
    }
  };

  const loadUnauthorizedAttempts = async () => {
    try {
      setIsLoadingAttempts(true);
      const list = await fetchUnauthorizedLoginAttemptsFromFirestore();
      setUnauthorizedAttempts(list);
    } catch (e) {
      console.warn('Lỗi tải danh sách nỗ lực đăng nhập bất thường:', e);
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  useEffect(() => {
    loadAuthorizedEmails();
    loadUnauthorizedAttempts();
  }, []);

  const handleStartEditTarget = (email: string, currentName: string, isRoot: boolean, role?: 'deputy_admin' | 'member') => {
    setEditingTarget({ email, currentName, isRoot, role });
    setEditNameValue(currentName);
    setEditRoleValue(role || 'member');
  };

  const handleSaveEditTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;
    const cleanName = editNameValue.trim();
    if (!cleanName) return;

    if (editingTarget.isRoot) {
      const updated = { ...adminCustomNames, [editingTarget.email]: cleanName };
      setAdminCustomNames(updated);
      try {
        localStorage.setItem('nak_admin_custom_names', JSON.stringify(updated));
      } catch {}

      // Keep name identical across admin tag and current session
      if (currentAdmin && (currentAdmin.googleEmail === editingTarget.email || editingTarget.email === getRootAdminEmails()[0])) {
        const updatedAdmin: SellerUser = { ...currentAdmin, name: cleanName };
        if (onUpdateCurrentAdmin) {
          onUpdateCurrentAdmin(updatedAdmin);
        }
        try {
          const sessionStr = localStorage.getItem('nak_admin_session');
          if (sessionStr) {
            const sess = JSON.parse(sessionStr);
            if (sess.user) {
              sess.user.name = cleanName;
              localStorage.setItem('nak_admin_session', JSON.stringify(sess));
            }
          }
        } catch {}
      }

      setEditingTarget(null);
      setAuthEmailSuccess(`Đã cập nhật tên thành công cho: ${editingTarget.email}`);
      setTimeout(() => setAuthEmailSuccess(''), 3000);
      return;
    }

    try {
      setIsSubmittingAuthEmail(true);
      const existing = authorizedEmails.find(a => a.email.toLowerCase() === editingTarget.email.toLowerCase());
      if (existing) {
        const updatedItem: AuthorizedSellerItem = {
          ...existing,
          name: cleanName,
          role: editRoleValue
        };
        await saveAuthorizedSellerToFirestore(updatedItem);
        setAuthorizedEmails(prev => prev.map(a => a.email.toLowerCase() === editingTarget.email.toLowerCase() ? updatedItem : a));
      }
      setEditingTarget(null);
      setAuthEmailSuccess(`Đã cập nhật tài khoản: ${editingTarget.email}`);
      setTimeout(() => setAuthEmailSuccess(''), 3000);
    } catch (err: any) {
      setAuthEmailError('Lỗi cập nhật tài khoản: ' + err.message);
    } finally {
      setIsSubmittingAuthEmail(false);
    }
  };

  const handleDeleteUnauthorizedAttempt = async (id: string) => {
    try {
      await deleteUnauthorizedLoginAttemptFromFirestore(id);
      setUnauthorizedAttempts(prev => prev.filter(item => item.id !== id));
      setAttemptSuccessMsg('Đã xóa 1 bản ghi cảnh báo.');
      setTimeout(() => setAttemptSuccessMsg(''), 3000);
    } catch (err) {
      console.warn('Lỗi xóa bản ghi cảnh báo:', err);
    }
  };

  const handleClearAllUnauthorizedAttempts = async () => {
    if (typeof window !== 'undefined' && window.confirm && !window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử cảnh báo đăng nhập bất thường?')) {
      return;
    }
    try {
      await clearAllUnauthorizedLoginAttemptsFromFirestore();
      setUnauthorizedAttempts([]);
      setAttemptSuccessMsg('Đã dọn sạch toàn bộ nhật ký cảnh báo.');
      setTimeout(() => setAttemptSuccessMsg(''), 3000);
    } catch (err) {
      console.warn('Lỗi dọn sạch cảnh báo:', err);
    }
  };

  const handleAddAuthorizedEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthEmailError('');
    setAuthEmailSuccess('');

    const cleanEmail = newEmailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthEmailError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    if (AUTHORIZED_ROOT_ADMIN_EMAILS.includes(cleanEmail)) {
      setAuthEmailError('Email này đã là Quản trị viên Tối cao (Root Admin).');
      return;
    }

    if (authorizedEmails.some(a => a.email.toLowerCase() === cleanEmail)) {
      setAuthEmailError('Email này đã có trong danh sách được ủy quyền.');
      return;
    }

    try {
      setIsSubmittingAuthEmail(true);
      const newAuthItem: AuthorizedSellerItem = {
        email: cleanEmail,
        name: newNameInput.trim() || cleanEmail.split('@')[0],
        role: newRoleInput,
        addedBy: currentAdmin?.googleEmail || currentAdmin?.username || 'Root Admin',
        createdAt: new Date().toISOString(),
        isActive: true
      };

      await saveAuthorizedSellerToFirestore(newAuthItem);
      setAuthorizedEmails(prev => [...prev.filter(a => a.email !== cleanEmail), newAuthItem]);
      setNewEmailInput('');
      setNewNameInput('');
      setAuthEmailSuccess(`Đã cấp quyền truy cập thành công cho: ${cleanEmail}`);
      setTimeout(() => setAuthEmailSuccess(''), 4000);
    } catch (err: any) {
      setAuthEmailError(err.message || 'Lỗi khi lưu ủy quyền vào Firestore.');
    } finally {
      setIsSubmittingAuthEmail(false);
    }
  };

  const handleRevokeAuthorizedEmail = async (emailToRevoke: string) => {
    const confirmMsg = `Bạn có chắc chắn muốn thu hồi quyền truy cập quản trị của email: ${emailToRevoke}?`;
    if (typeof window !== 'undefined' && window.confirm && !window.confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteAuthorizedSellerFromFirestore(emailToRevoke);
      setAuthorizedEmails(prev => prev.filter(a => a.email !== emailToRevoke));
      setAuthEmailSuccess(`Đã thu hồi quyền của ${emailToRevoke}.`);
      setTimeout(() => setAuthEmailSuccess(''), 4000);
    } catch (err: any) {
      console.error('Lỗi thu hồi quyền:', err);
    }
  };

  const handleOpenLogsForEmail = (
    email: string,
    name: string,
    isRoot: boolean,
    role: 'root_admin' | 'deputy_admin' | 'member' = isRoot ? 'root_admin' : 'member'
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const matchedSeller = sellers.find(s => 
      (s.googleEmail && s.googleEmail.toLowerCase() === cleanEmail) ||
      s.username.toLowerCase() === cleanEmail.split('@')[0]
    );
    if (matchedSeller) {
      setSelectedSellerForLogs(matchedSeller);
    } else {
      setSelectedSellerForLogs({
        id: `staff-${cleanEmail.replace(/[^a-z0-9]/g, '')}`,
        username: cleanEmail.split('@')[0],
        name: name,
        role: role,
        isRootAdmin: isRoot,
        isActive: true,
        createdAt: new Date().toISOString(),
        avatarColor: isRoot ? '#B41C1A' : (role === 'deputy_admin' ? '#7C3AED' : '#2563EB'),
        googleEmail: cleanEmail
      });
    }
  };

  const isRootAdmin = isRootAdminUser(currentAdmin);

  // Calculate stats per seller from orders
  const sellerStatsMap = useMemo(() => {
    const map: Record<string, { totalOrders: number; totalRevenue: number; completedOrders: number }> = {};
    
    // Initialize
    sellers.forEach((s) => {
      map[s.username.toLowerCase()] = { totalOrders: 0, totalRevenue: 0, completedOrders: 0 };
    });

    // Populate from orders
    orders.forEach((o) => {
      if (o.status === 'cancelled' || o.status === 'Đã hủy') return;

      // Do not track salesperson for orders from website or social media
      const isLockedSource = (o.source as string) === 'website' || (o.source as string) === 'mạng xã hội' || o.source === 'facebook' || o.source === 'tiktok' || o.source === 'instagram' || o.source === 'zalo' || o.source === 'shopee';
      if (isLockedSource) return;

      const sellerKey = o.sellerName ? o.sellerName.toLowerCase().trim() : '';
      if (!sellerKey && !o.sellerId) return;

      const matchedSeller = sellers.find(
        (s) => s.username.toLowerCase() === sellerKey || s.name.toLowerCase() === sellerKey || s.id === o.sellerId
      );

      if (matchedSeller) {
        const key = matchedSeller.username.toLowerCase();
        if (!map[key]) map[key] = { totalOrders: 0, totalRevenue: 0, completedOrders: 0 };
        map[key].totalOrders += 1;
        const netAmt = Math.max(0, (o.totalPrice || o.totalAmount || 0) - (Number(o.shippingFee) || 0));
        map[key].totalRevenue += netAmt;
        if (o.status === 'completed' || o.status === 'Đã giao' || o.status === 'Đơn hàng giao thành công') {
          map[key].completedOrders += 1;
        }
      }
    });

    return map;
  }, [sellers, orders]);

  // Filtered sellers list
  const filteredSellers = useMemo(() => {
    return sellers.filter((s) => {
      const matchSearch = 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm)) ||
        (s.googleEmail && s.googleEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ((s as any).email && (s as any).email.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchRole = true;
      if (filterRole === 'root_admin') {
        matchRole = isRootAdminUser(s);
      } else if (filterRole === 'deputy_admin') {
        matchRole = !isRootAdminUser(s) && s.role === 'deputy_admin';
      } else if (filterRole === 'member') {
        matchRole = !isRootAdminUser(s) && s.role !== 'deputy_admin';
      }

      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? s.isActive : !s.isActive);

      return matchSearch && matchRole && matchStatus;
    });
  }, [sellers, searchTerm, filterRole, filterStatus]);

  // Show temporary banner
  const triggerSuccess = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(''), 4500);
  };

  // Open inline Add Form
  const handleToggleAddForm = () => {
    if (isAddFormOpen) {
      setIsAddFormOpen(false);
    } else {
      setFormData({
        name: '',
        username: '',
        password: '',
        phone: '',
        googleEmail: '',
        role: 'member',
        isActive: true
      });
      setShowFormPassword(false);
      setEditingSellerId(null);
      setPasswordTargetSellerId(null);
      setDeletingSellerId(null);
      setPromotingSellerId(null);
      setDemotingSellerId(null);
      setIsAddFormOpen(true);
    }
  };

  // Start inline Edit
  const handleStartEdit = (seller: SellerUser) => {
    setEditingSellerId(seller.id);
    setPasswordTargetSellerId(null);
    setDeletingSellerId(null);
    setPromotingSellerId(null);
    setDemotingSellerId(null);
    setIsAddFormOpen(false);
    const isRoot = isRootAdminUser(seller);
    setFormData({
      name: seller.name,
      username: seller.username,
      password: '',
      phone: seller.phone || '',
      googleEmail: seller.googleEmail || (seller as any).email || '',
      role: isRoot ? 'root_admin' : (seller.role === 'deputy_admin' ? 'deputy_admin' : 'member'),
      isActive: seller.isActive
    });
  };

  // Start inline Change Password
  const handleStartPasswordChange = (seller: SellerUser) => {
    setPasswordTargetSellerId(seller.id);
    setEditingSellerId(null);
    setDeletingSellerId(null);
    setPromotingSellerId(null);
    setDemotingSellerId(null);
    setIsAddFormOpen(false);
    setNewPasswordInput('');
    setShowNewPassword(false);
  };

  // Start inline Delete Confirmation
  const handleStartDelete = (seller: SellerUser) => {
    setDeletingSellerId(seller.id);
    setEditingSellerId(null);
    setPasswordTargetSellerId(null);
    setPromotingSellerId(null);
    setDemotingSellerId(null);
    setIsAddFormOpen(false);
  };

  // Save new seller (Inline form)
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanName = formData.name.trim();
    const cleanPassword = formData.password.trim();
    const cleanGoogleEmail = formData.googleEmail ? formData.googleEmail.trim().toLowerCase() : '';

    if (!cleanName || !cleanUsername) {
      alert('Vui lòng nhập đầy đủ họ tên và tên đăng nhập.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      alert('Mật khẩu khởi tạo cần tối thiểu 6 ký tự.');
      return;
    }

    if (cleanGoogleEmail && !cleanGoogleEmail.includes('@')) {
      alert('Email Google không đúng định dạng.');
      return;
    }

    if (sellers.some((s) => s.username.toLowerCase() === cleanUsername)) {
      alert('Tên đăng nhập này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.');
      return;
    }

    if (cleanGoogleEmail && sellers.some((s) => s.googleEmail?.toLowerCase() === cleanGoogleEmail || (s as any).email?.toLowerCase() === cleanGoogleEmail)) {
      alert('Email Google này đã được liên kết với một tài khoản khác trong hệ thống.');
      return;
    }

    setIsSaving(true);
    try {
      const salt = generateSalt();
      const hash = await hashPassword(cleanPassword, salt);
      const colors = ['#B41C1A', '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777', '#0891B2', '#4F46E5'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      // Create Firebase Auth Account using a temporary secondary app to avoid logging out the admin
      try {
        const tempApp = initializeApp(firebaseConfig, 'TempApp-' + Date.now());
        const tempAuth = getAuth(tempApp);
        
        const email = `${cleanUsername}@notaknot.local`;
        await createUserWithEmailAndPassword(tempAuth, email, cleanPassword);
      } catch (authErr) {
        console.warn('Firebase Auth user creation info:', authErr);
      }

      const assignedRole = formData.role === 'deputy_admin' ? 'deputy_admin' : 'member';

      const newSeller: SellerUser = {
        id: `seller_${Date.now()}_${cleanUsername}`,
        name: cleanName,
        username: cleanUsername,
        passwordHash: hash,
        passwordSalt: salt,
        phone: formData.phone.trim() || undefined,
        googleEmail: cleanGoogleEmail || undefined,
        role: assignedRole,
        isRootAdmin: false,
        isActive: formData.isActive,
        createdAt: new Date().toISOString(),
        avatarColor: randomColor,
        isAutoCreated: false,
        lastLoginIp: '127.0.0.1',
        lastLoginCountry: 'Việt Nam',
        lastLoginCountryCode: 'VN',
        lastLoginCity: 'Hà Nội'
      };

      await saveSellerToFirestore(newSeller);

      const updated = deduplicateSellers([...sellers, newSeller]);
      onUpdateSellers(updated);

      setIsAddFormOpen(false);
      setFormData({
        name: '',
        username: '',
        password: '',
        phone: '',
        googleEmail: '',
        role: 'member',
        isActive: true
      });
      triggerSuccess(`Đã tạo thành công tài khoản "${cleanName}" (@${cleanUsername})!`);
    } catch (err: any) {
      console.error('Lỗi khi tạo người bán:', err);
      alert('Lỗi tạo tài khoản: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Save edited seller info
  const handleSaveEdit = async (seller: SellerUser, e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanGoogleEmail = formData.googleEmail ? formData.googleEmail.trim().toLowerCase() : '';

    if (!cleanName) {
      alert('Họ tên không được để trống.');
      return;
    }

    if (cleanGoogleEmail && !cleanGoogleEmail.includes('@')) {
      alert('Email Google không đúng định dạng.');
      return;
    }

    if (cleanGoogleEmail && sellers.some((s) => s.id !== seller.id && (s.googleEmail?.toLowerCase() === cleanGoogleEmail || (s as any).email?.toLowerCase() === cleanGoogleEmail))) {
      alert('Email Google này đã được liên kết với một tài khoản khác trong hệ thống.');
      return;
    }

    setIsSaving(true);
    try {
      const isRoot = isRootAdminUsername(seller.username) || isRootAdminUser(seller);
      const assignedRole = isRoot ? 'root_admin' : (formData.role === 'deputy_admin' ? 'deputy_admin' : 'member');

      const updatedSeller: SellerUser = {
        ...seller,
        name: cleanName,
        phone: formData.phone.trim() || undefined,
        googleEmail: cleanGoogleEmail || undefined,
        role: assignedRole,
        isRootAdmin: isRoot
      };

      await saveSellerToFirestore(updatedSeller);

      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(deduplicateSellers(updatedList));

      setEditingSellerId(null);
      triggerSuccess(`Đã cập nhật thông tin tài khoản "${cleanName}" thành công.`);
    } catch (err: any) {
      console.error('Lỗi cập nhật người bán:', err);
      alert('Lỗi khi lưu thông tin: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Save changed password
  const handleChangePassword = async (seller: SellerUser, e: React.FormEvent) => {
    e.preventDefault();

    if (isRootAdminUser(seller)) {
      alert('Không ai được quyền đổi mật khẩu của tài khoản Admin Root. Mật khẩu của Admin Root được bảo vệ tuyệt đối.');
      return;
    }

    if (!canChangeUserPassword(currentAdmin, seller)) {
      alert('Bạn không có quyền đổi mật khẩu cho tài khoản này.');
      return;
    }

    const cleanPass = newPasswordInput.trim();
    if (!cleanPass || cleanPass.length < 6) {
      alert('Mật khẩu mới cần tối thiểu 6 ký tự.');
      return;
    }

    setIsSaving(true);
    try {
      const salt = generateSalt();
      const hash = await hashPassword(cleanPass, salt);

      const updatedSeller: SellerUser = {
        ...seller,
        passwordHash: hash,
        passwordSalt: salt
      };

      await saveSellerToFirestore(updatedSeller);

      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(deduplicateSellers(updatedList));

      setPasswordTargetSellerId(null);
      setNewPasswordInput('');
      triggerSuccess(`Đã đổi mật khẩu cho tài khoản "${seller.name}" thành công!`);
    } catch (err: any) {
      console.error('Lỗi đổi mật khẩu:', err);
      alert('Lỗi khi đổi mật khẩu: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Link Google Account directly
  const handleLinkGoogle = async (seller: SellerUser) => {
    setIsSaving(true);
    try {
      const res = await linkGoogleAccountWithSeller(seller);
      if (!res.success || !res.updatedSeller) {
        alert(res.error || 'Liên kết Google thất bại.');
        setIsSaving(false);
        return;
      }
      const updatedList = sellers.map((s) => (s.id === seller.id ? res.updatedSeller! : s));
      onUpdateSellers(deduplicateSellers(updatedList));
      triggerSuccess(`Đã liên kết Google (${res.updatedSeller.googleEmail}) cho tài khoản "${seller.name}"!`);
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || 'Không thể liên kết Google.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Unlink Google Account
  const handleUnlinkGoogle = async (seller: SellerUser) => {
    if (!confirm(`Xác nhận hủy liên kết tài khoản Google khỏi "${seller.name}"?`)) return;
    setIsSaving(true);
    try {
      const res = await unlinkGoogleAccountFromSeller(seller);
      if (!res.success || !res.updatedSeller) {
        alert(res.error || 'Hủy liên kết thất bại.');
        setIsSaving(false);
        return;
      }
      const updatedList = sellers.map((s) => (s.id === seller.id ? res.updatedSeller! : s));
      onUpdateSellers(deduplicateSellers(updatedList));
      triggerSuccess(`Đã hủy liên kết Google của "${seller.name}".`);
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || 'Không thể hủy liên kết Google.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (seller: SellerUser) => {
    if (isRootAdminUsername(seller.username) || isRootAdminUser(seller)) {
      alert('Không thể khóa tài khoản Quản trị viên Tối cao (Root Admin).');
      return;
    }

    const nextStatus = !seller.isActive;
    try {
      const updatedSeller: SellerUser = {
        ...seller,
        isActive: nextStatus
      };

      await saveSellerToFirestore(updatedSeller);

      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(deduplicateSellers(updatedList));

      triggerSuccess(
        nextStatus 
          ? `Đã mở khóa tài khoản "${seller.name}".` 
          : `Đã tạm khóa tài khoản "${seller.name}".`
      );
    } catch (err: any) {
      console.error('Lỗi khóa tài khoản:', err);
      alert('Lỗi cập nhật trạng thái: ' + (err?.message || 'Vui lòng thử lại.'));
    }
  };

  // Confirm promote to Deputy Admin
  const handleConfirmPromote = async (seller: SellerUser) => {
    setIsSaving(true);
    try {
      const updatedSeller: SellerUser = {
        ...seller,
        role: 'deputy_admin',
        isRootAdmin: false
      };

      await saveSellerToFirestore(updatedSeller);

      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(deduplicateSellers(updatedList));

      setPromotingSellerId(null);
      triggerSuccess(`Đã nâng cấp tài khoản "${seller.name}" lên Phó Admin.`);
    } catch (err: any) {
      console.error('Lỗi nâng cấp:', err);
      alert('Lỗi nâng cấp tài khoản: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm demote to member
  const handleConfirmDemote = async (seller: SellerUser) => {
    if (isRootAdminUsername(seller.username) || isRootAdminUser(seller)) {
      alert('Không thể hạ quyền Quản trị viên Tối cao (Root Admin).');
      return;
    }

    setIsSaving(true);
    try {
      const updatedSeller: SellerUser = {
        ...seller,
        role: 'member',
        isRootAdmin: false
      };

      await saveSellerToFirestore(updatedSeller);

      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(deduplicateSellers(updatedList));

      setDemotingSellerId(null);
      triggerSuccess(`Đã chuyển tài khoản "${seller.name}" về Người bán thông thường.`);
    } catch (err: any) {
      console.error('Lỗi hạ quyền:', err);
      alert('Lỗi hạ quyền tài khoản: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm delete seller
  const handleConfirmDelete = async (seller: SellerUser) => {
    if (isRootAdminUsername(seller.username) || isRootAdminUser(seller)) {
      alert('Không thể xóa tài khoản Quản trị viên Tối cao (Root Admin).');
      return;
    }

    setIsSaving(true);
    try {
      await deleteSellerFromFirestore(seller.id, seller.googleEmail);

      const updatedList = sellers.filter((s) => s.id !== seller.id);
      onUpdateSellers(deduplicateSellers(updatedList));

      setDeletingSellerId(null);
      triggerSuccess(`Đã xóa vĩnh viễn tài khoản người bán "${seller.name}".`);
    } catch (err: any) {
      console.error('Lỗi xóa người bán:', err);
      alert('Lỗi khi xóa tài khoản: ' + (err?.message || 'Vui lòng thử lại.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Real-time login logs for selected seller
  const selectedSellerLogs = useMemo(() => {
    if (!selectedSellerForLogs) return [];

    const username = (selectedSellerForLogs.username || '').toLowerCase().trim();
    const name = (selectedSellerForLogs.name || '').toLowerCase().trim();

    // 1. Filter matching system logs
    const matchedSystemLogs = allLogs.filter((l) => {
      if (l.type !== 'admin_login' && l.source !== 'AdminAuth' && l.source !== 'AdminPresence') return false;
      const uId = (l.userId || '').toLowerCase().trim();
      const uName = (l.userName || '').toLowerCase().trim();
      const uTitle = (l.title || '').toLowerCase();
      const uMsg = (l.message || '').toLowerCase();

      return (
        (username && (uId === username || uName === username || uTitle.includes(username) || uMsg.includes(username))) ||
        (name && (uId === name || uName === name || uTitle.includes(name) || uMsg.includes(name)))
      );
    });

    // 2. Convert seller's ipHistory array into structured log items
    const documentIpHistoryLogs: SystemLogItem[] = (selectedSellerForLogs.ipHistory || []).map((ipItem, idx) => {
      const country = ipItem.country || 'Vietnam';
      const cLower = country.toLowerCase();
      let cCode = ipItem.countryCode || '';
      if (!cCode) {
        if (cLower.includes('netherland') || cLower.includes('hà lan') || cLower.includes('amsterdam') || cLower.includes('nl')) cCode = 'NL';
        else if (cLower.includes('vietnam') || cLower.includes('việt nam')) cCode = 'VN';
        else cCode = 'VN';
      }
      return {
        id: `doc-ip-${selectedSellerForLogs.id}-${idx}-${ipItem.timestamp}`,
        type: 'admin_login',
        level: 'info',
        title: `Đăng nhập hệ thống: ${selectedSellerForLogs.name}`,
        message: `Đăng nhập từ IP ${ipItem.ip} (${ipItem.city || country}) - Thiết bị: ${ipItem.device || 'Thiết bị quản trị'}`,
        timestamp: ipItem.timestamp,
        formattedDate: new Date(ipItem.timestamp).toLocaleString('vi-VN'),
        source: 'AdminAuth',
        userName: selectedSellerForLogs.name,
        userId: selectedSellerForLogs.username,
        status: cCode === 'VN' ? 'success' : 'blocked_geo',
        ip: ipItem.ip,
        city: ipItem.city || (cCode === 'NL' ? 'Amsterdam' : 'Hà Nội'),
        country: country,
        countryCode: cCode,
        browser: ipItem.device
      };
    });

    // 3. Fallback/Guaranteed presence log from seller's active document fields
    const sellerActiveLogs: SystemLogItem[] = [];
    if (
      selectedSellerForLogs.lastLoginIp && 
      selectedSellerForLogs.lastLoginIp !== 'Unknown' && 
      selectedSellerForLogs.lastLoginIp !== '127.0.0.1'
    ) {
      const activeTimestamp = selectedSellerForLogs.lastLoginAt || selectedSellerForLogs.lastSeenAt || selectedSellerForLogs.createdAt || new Date().toISOString();
      const country = selectedSellerForLogs.lastLoginCountry || 'Vietnam';
      const cLower = country.toLowerCase();
      let cCode = selectedSellerForLogs.lastLoginCountryCode || '';
      if (!cCode) {
        if (cLower.includes('netherland') || cLower.includes('hà lan') || cLower.includes('amsterdam') || cLower.includes('nl')) cCode = 'NL';
        else if (cLower.includes('vietnam') || cLower.includes('việt nam')) cCode = 'VN';
        else cCode = 'VN';
      }
      sellerActiveLogs.push({
        id: `seller-active-ip-${selectedSellerForLogs.id}-${activeTimestamp}`,
        type: 'admin_login',
        level: 'info',
        title: `Phiên hoạt động gần nhất: ${selectedSellerForLogs.name}`,
        message: `Hoạt động từ IP ${selectedSellerForLogs.lastLoginIp} (${selectedSellerForLogs.lastLoginCity || country}) - Thiết bị: ${selectedSellerForLogs.lastDevice || 'Trình duyệt Web'}`,
        timestamp: activeTimestamp,
        formattedDate: new Date(activeTimestamp).toLocaleString('vi-VN'),
        source: 'AdminPresence',
        userName: selectedSellerForLogs.name,
        userId: selectedSellerForLogs.username,
        status: cCode === 'VN' ? 'success' : 'blocked_geo',
        ip: selectedSellerForLogs.lastLoginIp,
        city: selectedSellerForLogs.lastLoginCity || (cCode === 'NL' ? 'Amsterdam' : 'Hà Nội'),
        country: country,
        countryCode: cCode,
        browser: selectedSellerForLogs.lastDevice || 'Trình duyệt Web'
      });
    }

    // Combine all sources
    const combined = [...sellerActiveLogs, ...documentIpHistoryLogs, ...matchedSystemLogs];
    const uniqueMap = new Map<string, SystemLogItem>();

    combined.forEach((item) => {
      const timeKey = item.timestamp ? new Date(item.timestamp).toISOString().slice(0, 14) : item.formattedDate;
      const key = `${item.ip || 'noip'}-${timeKey}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [allLogs, selectedSellerForLogs]);

  const handleRefreshSellerLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const [freshLogs, freshSnap] = await Promise.all([
        fetchSystemLogsFromFirestore(200),
        selectedSellerForLogs?.id ? getDoc(doc(db, 'sellers', selectedSellerForLogs.id)) : Promise.resolve(null)
      ]);
      setAllLogs(freshLogs);

      if (freshSnap && freshSnap.exists()) {
        const freshData = freshSnap.data();
        let parsedHistory: Array<{ ip: string; city?: string; country?: string; device?: string; timestamp: string }> = [];
        if (Array.isArray(freshData.ipHistory)) {
          parsedHistory = freshData.ipHistory.filter((item: any) => item && typeof item === 'object' && item.ip);
        }
        if (parsedHistory.length === 0 && freshData.lastLoginIp) {
          parsedHistory.push({
            ip: freshData.lastLoginIp,
            city: freshData.lastLoginCity || 'Hà Nội',
            country: freshData.lastLoginCountry || 'Vietnam',
            device: freshData.lastDevice || 'Thiết bị quản trị',
            timestamp: freshData.lastLoginAt || freshData.lastSeenAt || freshData.createdAt || new Date().toISOString()
          });
        }
        setSelectedSellerForLogs((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            lastLoginIp: freshData.lastLoginIp || prev.lastLoginIp,
            lastLoginCity: freshData.lastLoginCity || prev.lastLoginCity,
            lastLoginCountry: freshData.lastLoginCountry || prev.lastLoginCountry,
            lastSeenAt: freshData.lastSeenAt || prev.lastSeenAt,
            lastLoginAt: freshData.lastLoginAt || prev.lastLoginAt,
            lastDevice: freshData.lastDevice || prev.lastDevice,
            ipHistory: parsedHistory.length > 0 ? parsedHistory : prev.ipHistory
          };
        });
      }
      triggerSuccess('Đã cập nhật dữ liệu nhật ký đăng nhập và IP mới nhất từ Firebase.');
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCreateTestMemberLogin = async (seller: SellerUser) => {
    setTestLoginLogMessage(`Đang ghi log đăng nhập thử nghiệm cho ${seller.name}...`);
    try {
      const testTimestamp = new Date().toISOString();
      const testIp = '113.161.42.18';
      const testCity = 'Ho Chi Minh City';
      const testCountry = 'Vietnam';
      const testDevice = 'Chrome (macOS) / Quản trị viên';

      // 1. Write to system_logs collection
      await logAdminLogin({
        username: seller.username,
        name: seller.name,
        isRoot: seller.isRootAdmin,
        status: 'success',
        customGeo: {
          ip: testIp,
          country: testCountry,
          countryCode: 'VN',
          city: testCity,
          region: 'Thanh pho Ho Chi Minh',
          isp: 'VNPT Telecom Vietnam',
          isVietnam: true
        }
      });

      // 2. Persist to sellers collection presence and ipHistory on Firebase
      await updateSellerPresence(seller.id, {
        lastSeenAt: testTimestamp,
        lastLoginAt: testTimestamp,
        lastLoginIp: testIp,
        lastLoginCity: testCity,
        lastLoginCountry: testCountry,
        lastDevice: testDevice
      });

      // 3. Immediately reflect in local state
      const newIpItem = {
        ip: testIp,
        city: testCity,
        country: testCountry,
        device: testDevice,
        timestamp: testTimestamp
      };

      setSelectedSellerForLogs((prev) => {
        if (!prev || prev.id !== seller.id) return prev;
        return {
          ...prev,
          lastLoginIp: testIp,
          lastLoginCity: testCity,
          lastLoginCountry: testCountry,
          lastSeenAt: testTimestamp,
          lastLoginAt: testTimestamp,
          lastDevice: testDevice,
          ipHistory: [newIpItem, ...(prev.ipHistory || [])]
        };
      });

      setTestLoginLogMessage(`Đã lưu log đăng nhập lên Firebase (IP: ${testIp}) cho ${seller.name}!`);
      setTimeout(() => setTestLoginLogMessage(null), 3500);
    } catch {
      setTestLoginLogMessage('Không thể tạo bản ghi thử nghiệm.');
      setTimeout(() => setTestLoginLogMessage(null), 3500);
    }
  };

  const handleCopyIpText = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedLogIp(ip);
    setTimeout(() => setCopiedLogIp(null), 2000);
  };

  if (!isRootAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-amber-200 text-slate-700 shadow-xs">
        <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 mb-1">Khu vực dành riêng cho Quản Trị Viên Gốc</h3>
        <p className="text-sm text-slate-500">
          Chỉ tài khoản Quản trị viên mới có quyền tạo, cấu hình và quản lý tài khoản đội ngũ người bán.
        </p>
      </div>
    );
  }

  const staffAuthorizedList = useMemo(() => {
    return authorizedEmails.filter(a => !AUTHORIZED_ROOT_ADMIN_EMAILS.includes(a.email.trim().toLowerCase()));
  }, [authorizedEmails]);
  const totalCount = 2 + staffAuthorizedList.length;
  const deputyCount = staffAuthorizedList.filter(a => a.role === 'deputy_admin').length;
  const memberCount = staffAuthorizedList.filter(a => a.role !== 'deputy_admin').length;

  return (
    <div className="space-y-6 sm:space-y-8 text-slate-900 animate-fadeIn pb-24 sm:pb-12">
      
      {/* 1. Header Banner & Quick Actions - 100% Light Theme */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5 mb-1.5 flex-wrap">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
              Quản Trị Hệ Thống & Phân Quyền (Firebase Auth)
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-200 text-xs font-black">
                {totalCount} Tài khoản
              </span>
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                2 Tổng bí thư
              </span>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
                {deputyCount} Chủ tịch nước
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                {memberCount} Bộ trưởng
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2">
            Quản trị quyền truy cập Google Authentication cấp Cloud. Chỉ những email được phê duyệt dưới đây mới có quyền đăng nhập vào hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <button
            type="button"
            onClick={loadAuthorizedEmails}
            disabled={isLoadingAuthEmails}
            className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm border border-slate-300 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            title="Tải lại danh sách từ Firestore Cloud"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingAuthEmails ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Đồng bộ Cloud</span>
          </button>

          {isRootAdmin && (
            <button
              type="button"
              onClick={handleToggleAddForm}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer ${
                isAddFormOpen 
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300' 
                  : 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm active:scale-95'
              }`}
            >
              {isAddFormOpen ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{isAddFormOpen ? 'Đóng Biểu Mẫu' : 'Cấp quyền'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {authEmailSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in slide-in-from-top-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{authEmailSuccess}</span>
        </div>
      )}
      {authEmailError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in slide-in-from-top-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-semibold">{authEmailError}</span>
        </div>
      )}
      {attemptSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in slide-in-from-top-2 shadow-xs">
          <Check className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="font-semibold">{attemptSuccessMsg}</span>
        </div>
      )}

      {/* Inline Add Google Email Form (100% Light Theme) */}
      {isAddFormOpen && isRootAdmin && (
        <form onSubmit={handleAddAuthorizedEmail} className="bg-white border-2 border-amber-400 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-md animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                <UserPlus className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Cấp quyền truy cập (Google Firebase Auth)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 text-xs">
            <div className="sm:col-span-5">
              <label className="block text-slate-700 font-bold mb-1.5">
                Địa chỉ Email Google *
              </label>
              <input
                type="email"
                required
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                placeholder="ví dụ: nhanvien@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Nhân viên sẽ dùng Gmail này để bấm Đăng nhập bằng Google</span>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-slate-700 font-bold mb-1.5">
                Tên nhân viên (tùy chọn)
              </label>
              <input
                type="text"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs font-medium"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-slate-700 font-bold mb-1.5">
                Phân quyền vai trò
              </label>
              <select
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white text-xs font-bold cursor-pointer"
              >
                <option value="member">Bộ trưởng</option>
                <option value="deputy_admin">Chủ tịch nước</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmittingAuthEmail}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmittingAuthEmail ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Cấp quyền</span>
            </button>
          </div>
        </form>
      )}

      {/* RENAME / EDIT MODAL FOR TỔNG BÍ THƯ */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 p-5 sm:p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-100 text-sky-800">
                  <Edit2 className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-900">
                  Đổi thông tin tài khoản
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTarget} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email Google:</label>
                <div className="font-mono text-xs text-slate-800 bg-slate-100 p-2.5 rounded-xl border border-slate-200 font-bold">
                  {editingTarget.email}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Họ và tên hiển thị:</label>
                <input
                  type="text"
                  required
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white"
                  placeholder="Nhập họ và tên mới"
                />
              </div>

              {!editingTarget.isRoot && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phân quyền vai trò:</label>
                  <select
                    value={editRoleValue}
                    onChange={(e) => setEditRoleValue(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="member">Bộ trưởng</option>
                    <option value="deputy_admin">Chủ tịch nước</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAuthEmail}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAuthEmail ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. THE ONLY UNIFIED ADMIN & SELLERS TABLE (100% LIGHT THEME) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Danh Sách Quản Trị Viên & Nhân Viên Được Phép Truy Cập
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chỉ những tài khoản trong bảng này mới có thể đăng nhập bằng Google. Mọi tài khoản khác đều bị Firebase Auth từ chối truy cập.
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Google Auth 100%</span>
          </span>
        </div>

        {/* The Single Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5 sm:p-4">Tài khoản & Email Google</th>
                <th className="p-3.5 sm:p-4">Vai trò</th>
                <th className="p-3.5 sm:p-4">Bảo mật</th>
                <th className="p-3.5 sm:p-4">Trạng thái / Ngày cấp</th>
                <th className="p-3.5 sm:p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* ROOT ADMIN ROWS (Mapped dynamically without plain hardcoded personal identifiers) */}
              {AUTHORIZED_ROOT_ADMIN_EMAILS.map((rootEmail, idx) => {
                const isCurrent = currentAdmin?.googleEmail === rootEmail || (!currentAdmin?.googleEmail && currentAdmin?.isRootAdmin && idx === 0);
                const displayName = (isCurrent && currentAdmin?.name) 
                  ? currentAdmin.name 
                  : (adminCustomNames[rootEmail] || (idx === 0 ? 'Tổng bí thư' : `Tổng bí thư ${idx + 1}`));
                const initial = displayName.charAt(0).toUpperCase() || 'T';

                return (
                  <tr key={`root-admin-${rootEmail}-${idx}`} className="hover:bg-amber-50/20 transition-colors bg-amber-50/10">
                    <td className="p-3.5 sm:p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-600 text-white font-bold flex items-center justify-center shrink-0 shadow-xs">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900">{displayName}</div>
                          <div className="text-xs text-slate-500 font-mono">{rootEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 sm:p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Tổng bí thư
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Google Firebase Auth</span>
                      </span>
                    </td>
                    <td className="p-3.5 sm:p-4">
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-emerald-700">Toàn quyền hệ thống</span>
                        <div className="text-[10px] text-slate-400">Security Rules & Cloud DB</div>
                      </div>
                    </td>
                    <td className="p-3.5 sm:p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditTarget(rootEmail, displayName, true)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                          title="Đổi tên hiển thị"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Đổi tên</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenLogsForEmail(rootEmail, displayName, true)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                          title="Xem lịch sử đăng nhập & IP"
                        >
                          <History className="w-3.5 h-3.5 text-amber-700" />
                          <span>Log IP</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* STAFF ROWS (NO DUPLICATES) */}
              {staffAuthorizedList.map((item, idx) => (
                <tr key={`staff-auth-${item.email || idx}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 sm:p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl text-white font-bold flex items-center justify-center shrink-0 shadow-xs ${
                        item.role === 'deputy_admin' ? 'bg-purple-600' : 'bg-blue-600'
                      }`}>
                        {(item.name || item.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {item.name || item.email.split('@')[0]}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{item.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 sm:p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      item.role === 'deputy_admin'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}>
                      {item.role === 'deputy_admin' ? 'Chủ tịch nước' : 'Bộ trưởng'}
                    </span>
                  </td>
                  <td className="p-3.5 sm:p-4">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>Google Firebase Auth</span>
                    </span>
                  </td>
                  <td className="p-3.5 sm:p-4">
                    <div className="text-xs text-slate-600">
                      <div>Cấp bởi: <span className="font-semibold text-slate-800">{item.addedBy || 'Tổng bí thư'}</span></div>
                      <div className="text-[10px] text-slate-400">Ngày: {new Date(item.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>
                  </td>
                  <td className="p-3.5 sm:p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStartEditTarget(item.email, item.name || item.email.split('@')[0], false, item.role)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                        title="Đổi tên & Phân quyền"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>Đổi tên</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenLogsForEmail(item.email, item.name || item.email.split('@')[0], false, item.role)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                        title="Xem lịch sử đăng nhập & IP"
                      >
                        <History className="w-3.5 h-3.5 text-slate-600" />
                        <span>Log IP</span>
                      </button>

                      {isRootAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRevokeAuthorizedEmail(item.email)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer flex items-center gap-1"
                          title="Xóa tài khoản này"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Xóa</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {staffAuthorizedList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 bg-slate-50/30">
                    Chưa có nhân viên nào khác được cấp quyền. Bấm nút "Cấp quyền" ở trên để thêm nhân viên bằng Gmail.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. BẢNG NHẬT KÝ CÁC LƯỢT ĐĂNG NHẬP KHÔNG ĐƯỢC XÁC THỰC (UNAUTHORIZED ATTEMPTS LOG) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-100 text-rose-800">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Nhật Ký Cảnh Báo: Các Lượt Đăng Nhập Không Được Xác Thực
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                {unauthorizedAttempts.length} Lượt bị chặn
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Ghi nhận tự động mọi tài khoản Google lạ hoặc nỗ lực truy cập vào trang Quản trị không nằm trong danh sách được Tổng bí thư cấp quyền.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={loadUnauthorizedAttempts}
              disabled={isLoadingAttempts}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAttempts ? 'animate-spin' : ''}`} />
              <span>Tải lại</span>
            </button>

            {isRootAdmin && unauthorizedAttempts.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllUnauthorizedAttempts}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Xóa sạch lịch sử</span>
              </button>
            )}
          </div>
        </div>

        {/* Table of unauthorized login attempts */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3.5 sm:p-4">Thời gian</th>
                <th className="p-3.5 sm:p-4">Tên Email</th>
                <th className="p-3.5 sm:p-4">Địa chỉ IP</th>
                <th className="p-3.5 sm:p-4">Địa chỉ vật lý (từ IP)</th>
                <th className="p-3.5 sm:p-4">Thiết bị</th>
                <th className="p-3.5 sm:p-4">Trạng thái</th>
                {isRootAdmin && <th className="p-3.5 sm:p-4 text-center">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unauthorizedAttempts.map((attempt) => (
                <tr key={attempt.id} className="hover:bg-rose-50/20 transition-colors">
                  <td className="p-3.5 sm:p-4 text-slate-600 whitespace-nowrap font-mono text-xs">
                    <div className="font-semibold text-slate-800">
                      {new Date(attempt.timestamp).toLocaleTimeString('vi-VN')}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(attempt.timestamp).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="p-3.5 sm:p-4">
                    <div className="font-mono text-xs font-bold text-rose-900 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                      {attempt.email}
                    </div>
                    {attempt.name && (
                      <div className="text-[10px] text-slate-500 mt-0.5">Tên: {attempt.name}</div>
                    )}
                  </td>
                  <td className="p-3.5 sm:p-4 font-mono text-xs text-slate-800">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-bold">{attempt.ip}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyIpText(attempt.ip)}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer rounded"
                        title="Copy IP"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3.5 sm:p-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{attempt.location || 'Không xác định'}</span>
                    </div>
                  </td>
                  <td className="p-3.5 sm:p-4 text-slate-600 text-xs">
                    {attempt.device || 'Trình duyệt Web'}
                  </td>
                  <td className="p-3.5 sm:p-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-3 h-3 text-rose-500" />
                      <span>Đã chặn</span>
                    </span>
                  </td>
                  {isRootAdmin && (
                    <td className="p-3.5 sm:p-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteUnauthorizedAttempt(attempt.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Xóa bản ghi này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {unauthorizedAttempts.length === 0 && (
                <tr>
                  <td colSpan={isRootAdmin ? 7 : 6} className="p-8 text-center text-slate-400 bg-slate-50/20">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-1" />
                      <span className="font-semibold text-slate-700">Hệ thống an toàn tuyệt đối</span>
                      <span className="text-xs text-slate-400">Chưa ghi nhận nỗ lực đăng nhập trái phép nào.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DRAWER / MODAL: MEMBER LOGIN LOGS & IP SECURITY TRACKING */}
      {/* (Fully responsive bottom-sheet/modal for Mobile) */}
      {/* ======================================================== */}
      {selectedSellerForLogs && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            
            {/* 1. Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white font-black text-sm sm:text-base shrink-0 shadow-xs"
                  style={{ backgroundColor: selectedSellerForLogs.avatarColor || '#B41C1A' }}
                >
                  {selectedSellerForLogs.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                      {selectedSellerForLogs.name}
                    </h3>
                    {isRootAdminUser(selectedSellerForLogs) ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-200">
                        Quản trị viên
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Người bán
                      </span>
                    )}
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                      @{selectedSellerForLogs.username}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span>Lịch sử phiên IP đăng nhập trang quản trị</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                      Chỉ chấp nhận IP Việt Nam 🇻🇳
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleRefreshSellerLogs}
                  disabled={isLoadingLogs}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer active:scale-95"
                  title="Làm mới dữ liệu nhật ký"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSellerForLogs(null);
                    setTestLoginLogMessage(null);
                  }}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Test Status Banner */}
            {testLoginLogMessage && (
              <div className="mx-4 sm:mx-6 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in shrink-0">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{testLoginLogMessage}</span>
              </div>
            )}

            {/* 2. Quick Metrics Grid */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0">
              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">Tổng Lượt Đăng Nhập</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-0.5 block">
                  {selectedSellerLogs.length}
                </span>
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">Hợp Lệ (Việt Nam 🇻🇳)</span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 font-mono mt-0.5 block">
                  {selectedSellerLogs.filter((l) => l.status === 'success' && (!l.countryCode || l.countryCode === 'VN')).length}
                </span>
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">Cảnh Báo / Chặn</span>
                <span className="text-lg sm:text-xl font-black text-amber-600 font-mono mt-0.5 block">
                  {selectedSellerLogs.filter((l) => l.status === 'blocked_geo' || (l.countryCode && l.countryCode !== 'VN') || l.status === 'failed_password').length}
                </span>
              </div>

              <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 block">Vị Trí Gần Nhất</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                  {selectedSellerLogs[0] ? (
                    `${selectedSellerLogs[0].city || 'Hà Nội'}, ${selectedSellerLogs[0].country || 'Vietnam'} ${getCountryFlagEmoji(selectedSellerLogs[0].countryCode, selectedSellerLogs[0].country)}`
                  ) : selectedSellerForLogs.lastLoginCity ? (
                    `${selectedSellerForLogs.lastLoginCity}, ${selectedSellerForLogs.lastLoginCountry || 'Vietnam'} ${getCountryFlagEmoji(selectedSellerForLogs.lastLoginCountryCode, selectedSellerForLogs.lastLoginCountry)}`
                  ) : 'Chưa có dữ liệu'}
                </span>
              </div>
            </div>

            {/* 3. Action Toolbar */}
            <div className="px-4 sm:px-6 py-2 bg-white border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="text-xs text-slate-500 font-medium">
                Chi tiết các phiên đăng nhập:
              </div>
              <button
                type="button"
                onClick={() => handleCreateTestMemberLogin(selectedSellerForLogs)}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Thêm log thử nghiệm</span>
              </button>
            </div>

            {/* 4. Logs List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {selectedSellerLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-700">Chưa có lịch sử đăng nhập nào</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Bản ghi sẽ tự động xuất hiện khi tài khoản này đăng nhập vào hệ thống quản trị.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCreateTestMemberLogin(selectedSellerForLogs)}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Tạo bản ghi kiểm tra ngay</span>
                  </button>
                </div>
              ) : (
                selectedSellerLogs.map((log) => {
                  const isSuccess = log.status === 'success';
                  const isBlockedGeo = log.status === 'blocked_geo' || (log.countryCode && log.countryCode !== 'VN');
                  const isFailedPass = log.status === 'failed_password';

                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isBlockedGeo
                          ? 'bg-rose-50/50 border-rose-200'
                          : isFailedPass
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isSuccess && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đăng nhập thành công</span>
                            </span>
                          )}
                          {isBlockedGeo && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Chặn IP Ngoại Quốc</span>
                            </span>
                          )}
                          {isFailedPass && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Sai mật khẩu</span>
                            </span>
                          )}

                          <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {log.formattedDate || new Date(log.timestamp).toLocaleString('vi-VN')}
                            </span>
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold">
                          {isBlockedGeo ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <span>🚫 Ngoại quốc</span>
                              <span>({getCountryFlagEmoji(log.countryCode, log.country)} {log.country || 'Nước ngoài'})</span>
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold flex items-center gap-1">
                              <span>{getCountryFlagEmoji(log.countryCode, log.country)} Hợp lệ ({log.country || 'Lãnh thổ VN'})</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 text-xs">
                        {/* IP & Network */}
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[10px] font-bold block">ĐỊA CHỈ IP</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{log.ip || 'Chưa ghi nhận IP'}</span>
                            {log.ip && (
                              <button
                                type="button"
                                onClick={() => handleCopyIpText(log.ip!)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
                                title="Sao chép IP"
                              >
                                {copiedLogIp === log.ip ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                          {log.isp && (
                            <span className="text-[10px] text-slate-500 block truncate" title={log.isp}>
                              {log.isp}
                            </span>
                          )}
                        </div>

                        {/* Location */}
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[10px] font-bold block">VỊ TRÍ</span>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              {log.city || 'Hà Nội'}, {log.country || 'Vietnam'} {getCountryFlagEmoji(log.countryCode, log.country)}
                            </span>
                          </div>
                          {log.region && (
                            <span className="text-[10px] text-slate-500 block truncate">
                              {log.region}
                            </span>
                          )}
                        </div>

                        {/* Device & Browser */}
                        <div className="space-y-0.5">
                          <span className="text-slate-400 text-[10px] font-bold block">THIẾT BỊ</span>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {log.browser || 'Trình duyệt Web'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 5. Modal Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500">
                Hiển thị <strong className="text-slate-800">{selectedSellerLogs.length}</strong> bản ghi.
              </span>
              <button
                type="button"
                onClick={() => setSelectedSellerForLogs(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
