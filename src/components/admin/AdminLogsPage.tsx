import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck,
  UserCheck, 
  Activity, 
  Search, 
  Trash2, 
  RefreshCw, 
  Download, 
  Filter, 
  MapPin, 
  Globe, 
  Smartphone, 
  Laptop, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Eye, 
  AlertCircle,
  Sparkles,
  Copy,
  Check
} from 'lucide-react';
import { SystemLogItem, LogType, LogLevel } from '../../types';
import { 
  fetchSystemLogsFromFirestore, 
  subscribeToSystemLogs, 
  deleteSystemLogFromFirestore, 
  clearAllSystemLogsFromFirestore,
  logClientError,
  logSystemActivity
} from '../../utils/logger';

interface AdminLogsPageProps {
  isRootAdmin: boolean;
}

export const AdminLogsPage: React.FC<AdminLogsPageProps> = ({ isRootAdmin }) => {
  const [logs, setLogs] = useState<SystemLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'errors' | 'logins' | 'activity'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedLogDetail, setSelectedLogDetail] = useState<SystemLogItem | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testLogStatus, setTestLogStatus] = useState<string | null>(null);

  // Subscribe to real-time logs
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToSystemLogs((updatedLogs) => {
      setLogs(updatedLogs);
      setIsLoading(false);
    }, 200);

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    const freshLogs = await fetchSystemLogsFromFirestore(200);
    setLogs(freshLogs);
    setIsLoading(false);
  };

  const handleDeleteSingleLog = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi log này?')) return;
    await deleteSystemLogFromFirestore(id);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    if (selectedLogDetail?.id === id) {
      setSelectedLogDetail(null);
    }
  };

  const handleClearAll = async () => {
    await clearAllSystemLogsFromFirestore();
    setLogs([]);
    setShowClearConfirm(false);
    setSelectedLogDetail(null);
  };

  const handleTriggerTestLog = async () => {
    setTestLogStatus('Đang tạo log thử nghiệm...');
    try {
      await logClientError(
        new Error('Test Simulation Error: Thử nghiệm bắt lỗi giỏ hàng & thanh toán khách hàng'),
        'TestDevSimulation',
        { 
          simulation: true, 
          cartSummary: { itemsCount: 2, totalValue: 350000 },
          action: 'checkout_step_2'
        }
      );
      setTestLogStatus('Đã ghi 1 log lỗi thử nghiệm thành công!');
      setTimeout(() => setTestLogStatus(null), 3000);
    } catch {
      setTestLogStatus('Không thể tạo log thử nghiệm.');
      setTimeout(() => setTestLogStatus(null), 3000);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `system_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return logs.filter((log) => {
      // 1. Tab category filter
      if (activeFilterTab === 'errors') {
        if (!['client_error', 'checkout_error', 'api_error'].includes(log.type) && log.level !== 'error') {
          return false;
        }
      } else if (activeFilterTab === 'logins') {
        if (log.type !== 'admin_login') return false;
      } else if (activeFilterTab === 'activity') {
        if (log.type !== 'system_activity') return false;
      }

      // 2. Level filter
      if (selectedLevel !== 'all' && log.level !== selectedLevel) {
        return false;
      }

      // 3. Time filter
      if (timeFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        if (timeFilter === 'today' && logTime < todayStart) return false;
        if (timeFilter === '7days' && logTime < sevenDaysAgo) return false;
        if (timeFilter === '30days' && logTime < thirtyDaysAgo) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = log.title?.toLowerCase().includes(q);
        const matchMsg = log.message?.toLowerCase().includes(q);
        const matchIp = log.ip?.toLowerCase().includes(q);
        const matchUser = log.userName?.toLowerCase().includes(q) || log.userId?.toLowerCase().includes(q);
        const matchCity = log.city?.toLowerCase().includes(q) || log.country?.toLowerCase().includes(q);
        const matchSource = log.source?.toLowerCase().includes(q);
        const matchStack = log.stack?.toLowerCase().includes(q);

        if (!matchTitle && !matchMsg && !matchIp && !matchUser && !matchCity && !matchSource && !matchStack) {
          return false;
        }
      }

      return true;
    });
  }, [logs, activeFilterTab, selectedLevel, timeFilter, searchQuery]);

  // Metric stats
  const stats = useMemo(() => {
    const errorCount = logs.filter((l) => l.level === 'error' || l.type === 'client_error' || l.type === 'checkout_error').length;
    const loginCount = logs.filter((l) => l.type === 'admin_login').length;
    const blockedGeoCount = logs.filter((l) => l.status === 'blocked_geo' || (l.countryCode && l.countryCode !== 'VN')).length;
    const successLoginCount = logs.filter((l) => l.type === 'admin_login' && l.status === 'success').length;

    return { errorCount, loginCount, blockedGeoCount, successLoginCount, total: logs.length };
  }, [logs]);

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-900 border border-slate-200">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                System Log
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhật ký lỗi hệ thống, sự cố ứng dụng của khách hàng & hoạt động vận hành.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleTriggerTestLog}
            className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all border border-amber-200/60 flex items-center justify-center gap-1.5 cursor-pointer"
            title="Tạo 1 log lỗi thử nghiệm để kiểm tra hiển thị"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Thử nghiệm log lỗi</span>
          </button>

          <button
            type="button"
            onClick={handleExportLogs}
            disabled={logs.length === 0}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Xuất file JSON toàn bộ nhật ký"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xuất File</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isRootAdmin && logs.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all border border-rose-200 flex items-center gap-1.5 cursor-pointer"
              title="Xóa sạch toàn bộ nhật ký"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* Helpful notification about member login logs */}
      <div className="p-3.5 bg-sky-50/80 border border-sky-200 text-sky-950 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>
            <strong>Lịch sử & IP đăng nhập của thành viên:</strong> Bấm trực tiếp vào tên thành viên trong tab <strong>Quản trị viên</strong> để xem nhật ký đăng nhập, IP và vị trí của từng người.
          </span>
        </div>
      </div>

      {testLogStatus && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{testLogStatus}</span>
        </div>
      )}

      {/* 2. Overview Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Tổng Bản Ghi Log</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.total}</span>
            <span className="text-[10px] text-slate-400 font-medium">bản ghi</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-2xs ${
          stats.errorCount > 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${stats.errorCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
              Lỗi Client / Mua Hàng
            </span>
            <AlertTriangle className={`w-4 h-4 ${stats.errorCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${stats.errorCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats.errorCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">sự cố phát hiện</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Đăng Nhập Thành Công</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 font-mono">{stats.successLoginCount}</span>
            <span className="text-[10px] text-slate-400 font-medium">lượt (VN)</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-2xs ${
          stats.blockedGeoCount > 0 ? 'bg-amber-50/70 border-amber-200' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${stats.blockedGeoCount > 0 ? 'text-amber-800' : 'text-slate-500'}`}>
              Chặn IP Ngoài VN / Sai Pass
            </span>
            <ShieldAlert className={`w-4 h-4 ${stats.blockedGeoCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black font-mono ${stats.blockedGeoCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {stats.blockedGeoCount}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">lần phòng thủ</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Main Tab Category Selector */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
          <button
            type="button"
            onClick={() => setActiveFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilterTab === 'all'
                ? 'bg-white text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('errors')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'errors'
                ? 'bg-rose-500 text-white shadow-2xs'
                : 'text-slate-600 hover:text-rose-600'
            }`}
          >
            <span>Lỗi Client & Mua hàng</span>
            {stats.errorCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFilterTab === 'errors' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
              }`}>
                {stats.errorCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('logins')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeFilterTab === 'logins'
                ? 'bg-white text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Lịch sử & IP Đăng nhập</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
              {stats.loginCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilterTab('activity')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeFilterTab === 'activity'
                ? 'bg-white text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hoạt động hệ thống
          </button>
        </div>

        {/* Secondary Filters: Search, Level, Time */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo IP, tên người dùng, từ khóa lỗi, URL..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as any)}
            aria-label="Lọc theo cấp độ nghiêm trọng"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
          >
            <option value="all">Mọi cấp độ (All)</option>
            <option value="error">Chỉ Lỗi (Error)</option>
            <option value="warning">Cảnh báo (Warning)</option>
            <option value="info">Thông tin (Info)</option>
          </select>

          {/* Time Range Filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            aria-label="Lọc theo khoảng thời gian"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:outline-hidden cursor-pointer"
          >
            <option value="all">Toàn bộ thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày gần nhất</option>
            <option value="30days">30 ngày gần nhất</option>
          </select>
        </div>
      </div>

      {/* 4. Log Feed / Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-7 h-7 mx-auto animate-spin text-amber-500" />
            <p className="text-xs font-semibold">Đang tải dữ liệu nhật ký hệ thống...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2 p-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Terminal className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-800">Không có bản ghi nhật ký phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Hệ thống hiện đang hoạt động bình thường và chưa ghi nhận sự cố nào trong tiêu chí lọc.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isError = log.level === 'error' || log.type === 'client_error' || log.type === 'checkout_error';
              const isGeoBlocked = log.status === 'blocked_geo' || (log.countryCode && log.countryCode !== 'VN');
              const isLoginSuccess = log.type === 'admin_login' && log.status === 'success';

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLogDetail(log)}
                  className={`p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isError ? 'bg-rose-50/20' : isGeoBlocked ? 'bg-amber-50/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Icon Badge */}
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isError
                        ? 'bg-rose-100 text-rose-600'
                        : isGeoBlocked
                        ? 'bg-amber-100 text-amber-700'
                        : isLoginSuccess
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isError ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isGeoBlocked ? (
                        <ShieldAlert className="w-4 h-4" />
                      ) : isLoginSuccess ? (
                        <UserCheck className="w-4 h-4" />
                      ) : (
                        <Activity className="w-4 h-4" />
                      )}
                    </div>

                    {/* Log Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border font-mono ${
                          isError
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : isGeoBlocked
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : isLoginSuccess
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {log.type.replace('_', ' ')}
                        </span>

                        <span className="text-xs font-bold text-slate-900 truncate">
                          {log.title}
                        </span>

                        {log.count && log.count > 1 && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shrink-0">
                            <span>x{log.count}</span>
                            <span className="text-[9px] font-medium text-amber-800">(lặp lại)</span>
                          </span>
                        )}

                        {log.source && (
                          <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                            @{log.source}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {log.message}
                      </p>

                      {/* Meta pills: IP, Location, Time, Device */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {log.formattedDate || new Date(log.timestamp).toLocaleString('vi-VN')}
                        </span>

                        {log.ip && (
                          <span className="flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Globe className="w-3 h-3 text-slate-400" />
                            {log.ip}
                          </span>
                        )}

                        {log.country && (
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold ${
                            log.countryCode === 'VN'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-100 text-amber-900'
                          }`}>
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{log.city ? `${log.city}, ` : ''}{log.country}</span>
                            {log.countryCode && <span className="font-mono">({log.countryCode})</span>}
                          </span>
                        )}

                        {log.browser && (
                          <span className="text-slate-400 hidden md:inline">
                            • {log.browser} / {log.os}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingleLog(log.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa bản ghi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Detail Modal */}
      {selectedLogDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedLogDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    Chi tiết bản ghi nhật ký
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID: {selectedLogDetail.id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyText(JSON.stringify(selectedLogDetail, null, 2), selectedLogDetail.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {copiedId === selectedLogDetail.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Chép JSON</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLogDetail(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              {/* Title & Message */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm">
                  {selectedLogDetail.title}
                </div>
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                  {selectedLogDetail.message}
                </div>
              </div>

              {/* Stack Trace (if present) */}
              {selectedLogDetail.stack && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block">Stack Trace (Dấu vết mã nguồn):</span>
                  <pre className="p-3 bg-slate-950 text-rose-300 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed border border-slate-800">
                    {selectedLogDetail.stack}
                  </pre>
                </div>
              )}

              {/* IP & Location Security Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Địa chỉ IP & Mạng
                  </span>
                  <div className="font-mono font-bold text-slate-900">
                    {selectedLogDetail.ip || 'Không rõ IP'}
                  </div>
                  {selectedLogDetail.isp && (
                    <div className="text-slate-500 text-[11px]">
                      ISP: {selectedLogDetail.isp}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Vị Trí Địa Lý
                  </span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{selectedLogDetail.city ? `${selectedLogDetail.city}, ` : ''}{selectedLogDetail.country || 'Việt Nam'}</span>
                    <span className="text-[10px] font-mono font-normal text-slate-500">
                      ({selectedLogDetail.countryCode || 'VN'})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedLogDetail.countryCode === 'VN' ? '✅ Lãnh thổ Việt Nam hợp lệ' : '⛔ Ngoài phạm vi Việt Nam'}
                  </div>
                </div>
              </div>

              {/* Client & Device Environment */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Môi Trường Khách Hàng (User-Agent & URL)
                </span>
                {selectedLogDetail.url && (
                  <div className="text-slate-700 font-mono text-[11px] truncate">
                    URL: <a href={selectedLogDetail.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{selectedLogDetail.url}</a>
                  </div>
                )}
                <div className="text-slate-500 font-mono text-[11px] break-all">
                  UA: {selectedLogDetail.userAgent || 'Trình duyệt chuẩn'}
                </div>
              </div>

              {/* Extra Metadata (if present) */}
              {selectedLogDetail.metadata && Object.keys(selectedLogDetail.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 block">Dữ Liệu Bổ Sung (Metadata):</span>
                  <pre className="p-3 bg-slate-100 text-slate-800 rounded-xl overflow-x-auto text-[11px] font-mono border border-slate-200">
                    {JSON.stringify(selectedLogDetail.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Ghi nhận: {selectedLogDetail.formattedDate}
              </span>
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Logs Modal Confirmation */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-left">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Xóa toàn bộ nhật ký hệ thống?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Hành động này sẽ xóa sạch toàn bộ lịch sử log lỗi và phiên đăng nhập khỏi Firestore và bộ nhớ cục bộ. Bạn không thể hoàn tác.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-sm"
              >
                Xác nhận xóa sạch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
