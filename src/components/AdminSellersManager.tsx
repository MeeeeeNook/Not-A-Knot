import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, UserPlus, Key, ShieldCheck, UserCheck, UserX, Trash2, Edit2, 
  Search, Check, Eye, EyeOff, AlertTriangle, Phone, 
  TrendingUp, ShoppingBag, ShieldAlert, X, Sparkles, RefreshCw,
  Globe, MapPin, Clock, Laptop, Smartphone, CheckCircle2, XCircle, History, Copy
} from 'lucide-react';
import { SellerUser, SystemLogItem } from '../types';
import { StoredOrder, saveSellerToFirestore, deleteSellerFromFirestore } from '../firebase';
import { hashPassword, generateSalt, ROOT_ADMIN_USERNAME, deduplicateSellers } from '../utils/auth';
import { fetchSystemLogsFromFirestore, subscribeToSystemLogs, logAdminLogin } from '../utils/logger';

interface AdminSellersManagerProps {
  sellers: SellerUser[];
  orders: StoredOrder[];
  currentAdmin: SellerUser | null;
  onUpdateSellers: (newSellers: SellerUser[]) => void;
}

export const AdminSellersManager: React.FC<AdminSellersManagerProps> = ({
  sellers,
  orders,
  currentAdmin,
  onUpdateSellers
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'root_admin' | 'member'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

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

  // Inline action states (strictly NO POPUPS / MODALS)
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [passwordTargetSellerId, setPasswordTargetSellerId] = useState<string | null>(null);
  const [deletingSellerId, setDeletingSellerId] = useState<string | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    role: 'member' as 'root_admin' | 'member',
    isActive: true
  });
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');

  const isRootAdmin = currentAdmin?.isRootAdmin || currentAdmin?.username === ROOT_ADMIN_USERNAME;

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
      const isLockedSource = o.source === 'website' || o.source === 'mạng xã hội' || o.source === 'facebook' || o.source === 'tiktok' || o.source === 'instagram' || o.source === 'zalo' || o.source === 'shopee';
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
        map[key].totalRevenue += (o.totalPrice || o.totalAmount || 0);
        if (o.status === 'completed' || o.status === 'Đã giao') {
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
        (s.phone && s.phone.includes(searchTerm));

      const matchRole = filterRole === 'all' || s.role === filterRole;
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
        role: 'member',
        isActive: true
      });
      setShowFormPassword(false);
      setEditingSellerId(null);
      setPasswordTargetSellerId(null);
      setDeletingSellerId(null);
      setIsAddFormOpen(true);
    }
  };

  // Start inline Edit
  const handleStartEdit = (seller: SellerUser) => {
    setEditingSellerId(seller.id);
    setPasswordTargetSellerId(null);
    setDeletingSellerId(null);
    setIsAddFormOpen(false);
    setFormData({
      name: seller.name,
      username: seller.username,
      password: '',
      phone: seller.phone || '',
      role: seller.role,
      isActive: seller.isActive
    });
  };

  // Start inline Change Password
  const handleStartPasswordChange = (seller: SellerUser) => {
    setPasswordTargetSellerId(seller.id);
    setEditingSellerId(null);
    setDeletingSellerId(null);
    setIsAddFormOpen(false);
    setNewPasswordInput('');
    setShowNewPassword(false);
  };

  // Start inline Delete Confirmation
  const handleStartDelete = (seller: SellerUser) => {
    setDeletingSellerId(seller.id);
    setEditingSellerId(null);
    setPasswordTargetSellerId(null);
    setIsAddFormOpen(false);
  };

  // Save new seller (Inline form)
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanName = formData.name.trim();
    const cleanPassword = formData.password.trim();

    if (!cleanName || !cleanUsername) {
      alert('Vui lòng nhập đầy đủ họ tên và tên đăng nhập.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 6) {
      alert('Mật khẩu khởi tạo cần tối thiểu 6 ký tự.');
      return;
    }

    if (sellers.some((s) => s.username.toLowerCase() === cleanUsername)) {
      alert('Tên đăng nhập này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.');
      return;
    }

    setIsSaving(true);
    try {
      const salt = generateSalt();
      const hash = await hashPassword(cleanPassword, salt);
      const colors = ['#B41C1A', '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777', '#0891B2', '#4F46E5'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newSeller: SellerUser = {
        id: `seller-${cleanUsername}`,
        username: cleanUsername,
        name: cleanName,
        passwordHash: hash,
        passwordSalt: salt,
        isRootAdmin: formData.role === 'root_admin',
        role: formData.role,
        isActive: formData.isActive,
        createdAt: new Date().toISOString(),
        avatarColor: randomColor,
        phone: formData.phone.trim()
      };

      await saveSellerToFirestore(newSeller);
      const updated = deduplicateSellers([...sellers, newSeller]);
      onUpdateSellers(updated);
      setIsAddFormOpen(false);
      triggerSuccess(`Đã tạo thành công tài khoản người bán "${cleanName}" (@${cleanUsername}).`);
    } catch {
      alert('Lỗi tạo tài khoản người bán.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save edited seller info (Inline form)
  const handleSaveEdit = async (seller: SellerUser, e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    if (!cleanName) {
      alert('Vui lòng nhập họ tên người bán.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedSeller: SellerUser = {
        ...seller,
        name: cleanName,
        phone: formData.phone.trim(),
        role: seller.isRootAdmin ? 'root_admin' : formData.role,
        isActive: seller.isRootAdmin ? true : formData.isActive
      };

      await saveSellerToFirestore(updatedSeller);
      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(updatedList);
      setEditingSellerId(null);
      triggerSuccess(`Đã cập nhật thông tin người bán "${cleanName}".`);
    } catch {
      alert('Lỗi cập nhật tài khoản.');
    } finally {
      setIsSaving(false);
    }
  };

  // Change Password (Inline form)
  const handleChangePassword = async (seller: SellerUser, e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = newPasswordInput.trim();
    if (!cleanPassword || cleanPassword.length < 6) {
      alert('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }

    setIsSaving(true);
    try {
      const salt = generateSalt();
      const hash = await hashPassword(cleanPassword, salt);

      const updatedSeller: SellerUser = {
        ...seller,
        passwordHash: hash,
        passwordSalt: salt
      };

      await saveSellerToFirestore(updatedSeller);
      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(updatedList);
      setPasswordTargetSellerId(null);
      setNewPasswordInput('');
      triggerSuccess(`Đã đổi mật khẩu thành công cho "${seller.name}" (@${seller.username}).`);
    } catch {
      alert('Lỗi đổi mật khẩu.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Active/Inactive status
  const handleToggleStatus = async (seller: SellerUser) => {
    if (seller.isRootAdmin || seller.username === ROOT_ADMIN_USERNAME) {
      alert('Không thể khóa tài khoản Quản trị viên gốc.');
      return;
    }

    const nextState = !seller.isActive;
    try {
      const updatedSeller: SellerUser = { ...seller, isActive: nextState };
      await saveSellerToFirestore(updatedSeller);
      const updatedList = sellers.map((s) => (s.id === seller.id ? updatedSeller : s));
      onUpdateSellers(updatedList);
      triggerSuccess(`Đã ${nextState ? 'kích hoạt' : 'tạm khóa'} tài khoản "${seller.name}".`);
    } catch {
      alert('Lỗi thay đổi trạng thái tài khoản.');
    }
  };

  // Confirm Delete Seller (Inline)
  const handleConfirmDelete = async (seller: SellerUser) => {
    if (seller.isRootAdmin || seller.username === ROOT_ADMIN_USERNAME) {
      alert('Không thể xóa tài khoản Quản trị viên gốc.');
      setDeletingSellerId(null);
      return;
    }

    setIsSaving(true);
    try {
      await deleteSellerFromFirestore(seller.id);
      const updatedList = sellers.filter((s) => s.id !== seller.id);
      onUpdateSellers(updatedList);
      setDeletingSellerId(null);
      triggerSuccess(`Đã xóa tài khoản người bán "${seller.name}".`);
    } catch {
      alert('Lỗi xóa người bán.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered logs for currently selected seller
  const selectedSellerLogs = useMemo(() => {
    if (!selectedSellerForLogs) return [];
    const username = selectedSellerForLogs.username.toLowerCase();
    const name = selectedSellerForLogs.name.toLowerCase();

    return allLogs.filter((l) => {
      if (l.type !== 'admin_login') return false;
      const uId = (l.userId || '').toLowerCase();
      const uName = (l.userName || '').toLowerCase();
      const uTitle = (l.title || '').toLowerCase();
      const uMsg = (l.message || '').toLowerCase();

      return uId === username || uName === name || uTitle.includes(username) || uMsg.includes(username);
    });
  }, [allLogs, selectedSellerForLogs]);

  const handleRefreshSellerLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const fresh = await fetchSystemLogsFromFirestore(200);
      setAllLogs(fresh);
      triggerSuccess('Đã cập nhật dữ liệu nhật ký đăng nhập mới nhất.');
    } catch {
      // ignore
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCreateTestMemberLogin = async (seller: SellerUser) => {
    setTestLoginLogMessage(`Đang ghi log đăng nhập thử nghiệm cho ${seller.name}...`);
    try {
      await logAdminLogin({
        username: seller.username,
        name: seller.name,
        isRoot: seller.isRootAdmin,
        status: 'success',
        customGeo: {
          ip: '113.161.42.18',
          country: 'Vietnam',
          countryCode: 'VN',
          city: 'Ho Chi Minh City',
          region: 'Thanh pho Ho Chi Minh',
          isp: 'VNPT Telecom Vietnam',
          isVietnam: true
        }
      });
      setTestLoginLogMessage(`Đã tạo 1 bản ghi đăng nhập thành công từ TP.HCM cho ${seller.name}!`);
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

  return (
    <div className="space-y-6 text-slate-900">
      
      {/* 1. Header Banner & Quick Actions - Light Mode */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200">
              <Users className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Quản Trị Hệ Thống & Tài Khoản Người Bán
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black">
              {sellers.length} Thành viên
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500">
            Quản trị quyền truy cập nội bộ, quản lý tài khoản bán hàng và theo dõi hiệu suất doanh số của từng cá nhân.
          </p>
        </div>

        <button
          type="button"
          onClick={handleToggleAddForm}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer shrink-0 ${
            isAddFormOpen 
              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300' 
              : 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm'
          }`}
        >
          {isAddFormOpen ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          <span>{isAddFormOpen ? 'Đóng Biểu Mẫu' : 'Thêm Người Bán Mới'}</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {actionSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in slide-in-from-top-2 shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* 2. INLINE ADD SELLER FORM (No Popup!) */}
      {isAddFormOpen && (
        <div className="bg-white border-2 border-amber-400/80 rounded-2xl p-5 sm:p-6 shadow-md animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
                <UserPlus className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Tạo Tài Khoản Người Bán Mới (Nhập Trực Tiếp)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateSeller} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Họ và tên người bán <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Thu Trang"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Tên đăng nhập (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  placeholder="thutrang"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Chữ thường, viết liền không dấu</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showFormPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Số điện thoại / Zalo
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0912345678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddFormOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isSaving ? 'Đang tạo...' : 'Lưu & Kích Hoạt Tài Khoản'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Search & Filters Bar - Light Mode */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm người bán theo tên, tài khoản hoặc SĐT..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Tạm khóa</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="root_admin">Quản trị viên</option>
            <option value="member">Người bán (Thành viên)</option>
          </select>
        </div>
      </div>

      {/* 4. MAIN TABLE PRESENTATION (Pure Light Mode Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold select-none">
                <th className="p-3.5 whitespace-nowrap min-w-[200px]">Thành viên</th>
                <th className="p-3.5 whitespace-nowrap min-w-[140px]">Tài khoản</th>
                <th className="p-3.5 whitespace-nowrap min-w-[130px]">Vai trò</th>
                <th className="p-3.5 whitespace-nowrap min-w-[120px]">Số điện thoại</th>
                <th className="p-3.5 whitespace-nowrap min-w-[130px]">Trạng thái</th>
                <th className="p-3.5 whitespace-nowrap min-w-[160px] text-right">Hiệu suất đơn hàng</th>
                <th className="p-3.5 whitespace-nowrap min-w-[180px] text-center sticky right-0 bg-slate-50 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.04)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deduplicateSellers(filteredSellers).map((seller, sIdx) => {
                const stats = sellerStatsMap[seller.username.toLowerCase()] || { totalOrders: 0, totalRevenue: 0, completedOrders: 0 };
                const isRoot = seller.isRootAdmin || seller.username === ROOT_ADMIN_USERNAME;
                const isEditing = editingSellerId === seller.id;
                const isChangingPassword = passwordTargetSellerId === seller.id;
                const isDeleting = deletingSellerId === seller.id;

                return (
                  <React.Fragment key={`seller-mgr-frag-${seller.id || seller.username}-${sIdx}`}>
                    <tr className={`hover:bg-slate-50/80 transition-colors ${
                      isEditing || isChangingPassword || isDeleting ? 'bg-amber-50/40' : ''
                    }`}>
                      {/* Column 1: Member Info & Avatar */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedSellerForLogs(seller)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-2xs hover:opacity-85 hover:scale-105 transition-all cursor-pointer group"
                            style={{ backgroundColor: seller.avatarColor || '#B41C1A' }}
                            title="Bấm để xem lịch sử đăng nhập & IP của thành viên này"
                          >
                            <span>{seller.name.slice(0, 1).toUpperCase()}</span>
                          </button>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedSellerForLogs(seller)}
                              className="font-bold text-slate-900 hover:text-amber-800 flex items-center gap-1.5 text-sm transition-colors cursor-pointer text-left group"
                              title="Bấm để xem lịch sử đăng nhập, IP & vị trí của thành viên này"
                            >
                              <span className="group-hover:underline">{seller.name}</span>
                              {isRoot && (
                                <span title="Quản trị viên tối cao">
                                  <ShieldCheck className="w-4 h-4 text-amber-500 inline shrink-0" />
                                </span>
                              )}
                              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 group-hover:bg-amber-100 border border-amber-200/80 px-1.5 py-0.2 rounded-md flex items-center gap-1 transition-colors">
                                <History className="w-2.5 h-2.5" />
                                <span>Log</span>
                              </span>
                            </button>
                            <span className="text-[11px] text-slate-400">
                              Tạo: {new Date(seller.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Username */}
                      <td className="p-3.5">
                        <span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {seller.username}
                        </span>
                      </td>

                      {/* Column 3: Role Badge */}
                      <td className="p-3.5">
                        {isRoot ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                            <span>Quản trị viên</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <span>Người bán</span>
                          </span>
                        )}
                      </td>

                      {/* Column 4: Phone */}
                      <td className="p-3.5 font-mono text-slate-600">
                        {seller.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{seller.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Column 5: Status */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          seller.isActive 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${seller.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{seller.isActive ? 'Hoạt động' : 'Tạm khóa'}</span>
                        </span>
                      </td>

                      {/* Column 6: Stats & Performance */}
                      <td className="p-3.5 text-right">
                        <div className="font-bold text-slate-900 text-xs">
                          {stats.totalOrders} <span className="font-normal text-slate-500">đơn</span>
                        </div>
                        <div className="font-extrabold text-emerald-700 text-xs mt-0.5">
                          {stats.totalRevenue.toLocaleString('vi-VN')}₫
                        </div>
                      </td>

                      {/* Column 7: Actions */}
                      <td className="p-3.5 text-center sticky right-0 bg-white/95 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Member Login Logs Trigger */}
                          <button
                            type="button"
                            onClick={() => setSelectedSellerForLogs(seller)}
                            className="px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200"
                            title="Xem lịch sử đăng nhập & IP của thành viên"
                          >
                            <History className="w-3 h-3 text-amber-700" />
                            <span>Log IP</span>
                          </button>

                          {/* Change Password Inline Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isChangingPassword) {
                                setPasswordTargetSellerId(null);
                              } else {
                                handleStartPasswordChange(seller);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                              isChangingPassword
                                ? 'bg-amber-400 text-slate-950 shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Đổi mật khẩu"
                          >
                            <Key className="w-3 h-3 text-amber-700" />
                            <span>Đổi MK</span>
                          </button>

                          {/* Edit Inline Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isEditing) {
                                setEditingSellerId(null);
                              } else {
                                handleStartEdit(seller);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer ${
                              isEditing
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-3 h-3 text-sky-600" />
                            <span>Sửa</span>
                          </button>

                          {/* Toggle Active / Inactive status */}
                          {!isRoot && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(seller)}
                                className={`p-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                  seller.isActive
                                    ? 'bg-slate-100 hover:bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 hover:bg-emerald-100 text-emerald-700'
                                }`}
                                title={seller.isActive ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'}
                              >
                                {seller.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>

                              {/* Delete Inline Trigger */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isDeleting) {
                                    setDeletingSellerId(null);
                                  } else {
                                    handleStartDelete(seller);
                                  }
                                }}
                                className={`p-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                                  isDeleting
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-slate-100 hover:bg-rose-100 text-rose-600'
                                }`}
                                title="Xóa tài khoản"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* INLINE ROW SUB-PANEL: EDIT SELLER (NO POPUP) */}
                    {isEditing && (
                      <tr className="bg-sky-50/50 border-y-2 border-sky-300">
                        <td colSpan={7} className="p-4">
                          <form onSubmit={(e) => handleSaveEdit(seller, e)} className="space-y-3">
                            <div className="flex items-center gap-2 text-sky-900 font-bold text-xs pb-1 border-b border-sky-200">
                              <Edit2 className="w-3.5 h-3.5 text-sky-700" />
                              <span>Chỉnh sửa thông tin người bán: {seller.name}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div>
                                <label className="block text-slate-700 font-semibold mb-1">Họ và tên</label>
                                <input
                                  type="text"
                                  required
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-sky-600"
                                />
                              </div>
                              <div>
                                <label className="block text-slate-700 font-semibold mb-1">Số điện thoại / Zalo</label>
                                <input
                                  type="tel"
                                  value={formData.phone}
                                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                  placeholder="0912345678"
                                  className="w-full px-3 py-1.5 bg-white border border-sky-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:border-sky-600"
                                />
                              </div>
                              <div className="flex items-end gap-2">
                                <button
                                  type="submit"
                                  disabled={isSaving}
                                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                  {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingSellerId(null)}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 font-semibold rounded-lg text-xs border border-slate-300 cursor-pointer"
                                >
                                  Đóng
                                </button>
                              </div>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}

                    {/* INLINE ROW SUB-PANEL: CHANGE PASSWORD (NO POPUP) */}
                    {isChangingPassword && (
                      <tr className="bg-amber-50/70 border-y-2 border-amber-300">
                        <td colSpan={7} className="p-4">
                          <form onSubmit={(e) => handleChangePassword(seller, e)} className="space-y-3">
                            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs pb-1 border-b border-amber-200">
                              <Key className="w-3.5 h-3.5 text-amber-700" />
                              <span>Đổi mật khẩu tài khoản: {seller.name}</span>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
                              <div className="relative w-full sm:w-80">
                                <input
                                  type={showNewPassword ? 'text' : 'password'}
                                  required
                                  value={newPasswordInput}
                                  onChange={(e) => setNewPasswordInput(e.target.value)}
                                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                  className="w-full pl-3 pr-8 py-1.5 bg-white border border-amber-300 rounded-lg text-slate-900 text-xs font-mono focus:outline-none focus:border-amber-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  disabled={isSaving}
                                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                >
                                  {isSaving ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPasswordTargetSellerId(null);
                                    setNewPasswordInput('');
                                  }}
                                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 font-semibold rounded-lg text-xs border border-slate-300 cursor-pointer"
                                >
                                  Đóng
                                </button>
                              </div>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}

                    {/* INLINE ROW SUB-PANEL: DELETE CONFIRMATION (NO POPUP) */}
                    {isDeleting && (
                      <tr className="bg-rose-50 border-y-2 border-rose-300">
                        <td colSpan={7} className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 text-rose-900 font-semibold">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>
                                Xác nhận xóa vĩnh viễn tài khoản người bán <strong>{seller.name}</strong>?
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleConfirmDelete(seller)}
                                disabled={isSaving}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                {isSaving ? 'Đang xóa...' : 'Xác Nhận Xóa'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSellerId(null)}
                                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs border border-slate-300 cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredSellers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Không tìm thấy tài khoản người bán nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DRAWER / MODAL: MEMBER LOGIN LOGS & IP SECURITY TRACKING */}
      {/* ======================================================== */}
      {selectedSellerForLogs && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* 1. Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base shrink-0 shadow-xs"
                  style={{ backgroundColor: selectedSellerForLogs.avatarColor || '#B41C1A' }}
                >
                  {selectedSellerForLogs.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      Lịch Sử Đăng Nhập: {selectedSellerForLogs.name}
                    </h3>
                    {selectedSellerForLogs.isRootAdmin || selectedSellerForLogs.username === ROOT_ADMIN_USERNAME ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        Quản trị viên
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Người bán
                      </span>
                    )}
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                      @{selectedSellerForLogs.username}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span>IP & Vị trí thực tế của các phiên đăng nhập vào trang quản trị</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Chỉ chấp nhận IP Việt Nam 🇻🇳
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRefreshSellerLogs}
                  disabled={isLoadingLogs}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
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
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Test Status Banner */}
            {testLoginLogMessage && (
              <div className="mx-6 mt-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{testLoginLogMessage}</span>
              </div>
            )}

            {/* 2. Quick Metrics */}
            <div className="px-5 sm:px-6 py-4 bg-slate-50/80 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">Tổng Lượt Đăng Nhập</span>
                <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
                  {selectedSellerLogs.length}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">Hợp Lệ (Việt Nam 🇻🇳)</span>
                <span className="text-xl font-black text-emerald-600 font-mono mt-0.5 block">
                  {selectedSellerLogs.filter((l) => l.status === 'success' && (!l.countryCode || l.countryCode === 'VN')).length}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">Bị Chặn / Cảnh Báo</span>
                <span className="text-xl font-black text-amber-600 font-mono mt-0.5 block">
                  {selectedSellerLogs.filter((l) => l.status === 'blocked_geo' || (l.countryCode && l.countryCode !== 'VN') || l.status === 'failed_password').length}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">Vị Trí Gần Nhất</span>
                <span className="text-xs font-bold text-slate-800 mt-1 block truncate">
                  {selectedSellerLogs[0]?.city ? `${selectedSellerLogs[0].city}, VN 🇻🇳` : 'Chưa có dữ liệu'}
                </span>
              </div>
            </div>

            {/* 3. Action Toolbar */}
            <div className="px-5 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-slate-500 font-medium">
                Danh sách chi tiết các phiên đăng nhập của <strong className="text-slate-900">{selectedSellerForLogs.name}</strong>:
              </div>
              <button
                type="button"
                onClick={() => handleCreateTestMemberLogin(selectedSellerForLogs)}
                className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200/80 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Ghi log đăng nhập thử nghiệm</span>
              </button>
            </div>

            {/* 4. Logs List */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
              {selectedSellerLogs.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
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
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
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
                      className={`p-4 rounded-2xl border transition-all ${
                        isBlockedGeo
                          ? 'bg-rose-50/50 border-rose-200'
                          : isFailedPass
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-white border-slate-200/80 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Status Badge */}
                          {isSuccess && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đăng nhập thành công</span>
                            </span>
                          )}
                          {isBlockedGeo && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>Chặn IP Ngoại Quốc (Bảo vệ)</span>
                            </span>
                          )}
                          {isFailedPass && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
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

                        {/* Security check note */}
                        <div className="text-[11px] font-semibold">
                          {isBlockedGeo ? (
                            <span className="text-rose-600 font-bold">🚫 Từ chối truy cập ngoài VN</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">🇻🇳 Hợp lệ (Lãnh thổ VN)</span>
                          )}
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
                        {/* IP & Network */}
                        <div className="space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block">ĐỊA CHỈ IP & NHÀ MẠNG</span>
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{log.ip || '127.0.0.1'}</span>
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
                            <span className="text-[11px] text-slate-500 block truncate" title={log.isp}>
                              {log.isp}
                            </span>
                          )}
                        </div>

                        {/* Location */}
                        <div className="space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block">VỊ TRÍ ĐỊA LÝ (GEOLOCATION)</span>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              {log.city || 'Hồ Chí Minh'}, {log.country || 'Việt Nam'} {log.countryCode === 'VN' || !log.countryCode ? '🇻🇳' : '🌐'}
                            </span>
                          </div>
                          {log.region && (
                            <span className="text-[11px] text-slate-500 block truncate">
                              Khu vực: {log.region}
                            </span>
                          )}
                        </div>

                        {/* Device & Browser */}
                        <div className="space-y-1">
                          <span className="text-slate-400 text-[10px] font-bold block">THIẾT BỊ & TRÌNH DUYỆT</span>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {log.browser || 'Trình duyệt Web'} trên {log.os || 'Hệ điều hành'}
                            </span>
                          </div>
                          {log.userAgent && (
                            <span className="text-[10px] text-slate-400 font-mono block truncate" title={log.userAgent}>
                              {log.userAgent.slice(0, 45)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 5. Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Hiển thị <strong className="text-slate-800">{selectedSellerLogs.length}</strong> bản ghi đăng nhập.
              </span>
              <button
                type="button"
                onClick={() => setSelectedSellerForLogs(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors cursor-pointer"
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
