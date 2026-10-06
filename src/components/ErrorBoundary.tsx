import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      try {
        window.location.href = '/';
      } catch {
        window.location.reload();
      }
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen min-h-[100dvh] w-full flex-grow flex flex-col items-center justify-center p-6 text-center bg-neutral-950 text-white select-none">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-amber-100 mb-2">
            {this.props.fallbackTitle || 'Hệ thống đã tự phục hồi giao diện'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-6 leading-relaxed">
            Đã có gián đoạn tạm thời trong quá trình nạp giao diện. Vui lòng bấm làm mới hoặc quay lại trang chính.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử lại ngay</span>
            </button>
            <a
              href="/"
              className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-neutral-700 active:scale-95"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Về Trang Chủ</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
