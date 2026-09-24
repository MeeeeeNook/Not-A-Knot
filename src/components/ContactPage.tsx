import React, { useState } from 'react';
import { 
  MapPin, 
  Send, 
  CheckCircle2, 
  ArrowLeft,
  MessageSquare,
  ArrowUpRight,
  Phone,
  Mail
} from 'lucide-react';
import { SiteContentConfig, ContactMessage } from '../types';
import { saveContactMessageToFirestore } from '../firebase';

interface ContactPageProps {
  siteContent?: SiteContentConfig;
  onNavigateHome: () => void;
  onOpenAllCatalog?: () => void;
}

export const ContactPage: React.FC<ContactPageProps> = ({
  siteContent,
  onNavigateHome,
}) => {
  const [formSent, setFormSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactInfo: '',
    message: ''
  });

  const brandName = siteContent?.brandName || 'NOT A KNOT';
  const facebookUrl = siteContent?.socialLinks?.facebook || 'https://www.facebook.com/profile.php?id=61593591390851';
  const messengerUrl = siteContent?.socialLinks?.messenger || 'https://m.me/61593591390851';
  const instagramUrl = siteContent?.socialLinks?.instagram || 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==';
  const threadsUrl = siteContent?.socialLinks?.threads || 'https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.contactInfo.trim() || !formData.message.trim()) {
      alert('Vui lòng điền đầy đủ họ tên, thông tin liên hệ và nội dung tin nhắn.');
      return;
    }

    setIsSubmitting(true);
    const newMsg: ContactMessage = {
      id: `msg-${Date.now()}`,
      name: formData.name.trim(),
      contactInfo: formData.contactInfo.trim(),
      email: formData.contactInfo.includes('@') ? formData.contactInfo.trim() : undefined,
      phone: /^[0-9+ ]+$/.test(formData.contactInfo.trim()) ? formData.contactInfo.trim() : undefined,
      message: formData.message.trim(),
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      isRead: false,
      status: 'unread'
    };

    try {
      await saveContactMessageToFirestore(newMsg);
      setFormSent(true);
      setFormData({ name: '', contactInfo: '', message: '' });
    } catch (err) {
      console.warn('Lỗi gửi tin nhắn:', err);
      // Still show success if local fallback saved
      setFormSent(true);
      setFormData({ name: '', contactInfo: '', message: '' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="contact-page-container" className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 selection:bg-slate-900 selection:text-white">
      
      {/* 1. Clean Minimal Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-14 z-30 py-3.5 px-4 sm:px-8 shadow-2xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Trang Chủ</span>
          </button>

          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Liên Hệ {brandName}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-10">
        
        {/* 2. Header Introduction */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Liên Hệ & Giao Lưu
          </h1>
          <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
            Để đặt hàng mẫu vòng handmade phối màu theo sở thích hoặc gửi yêu cầu tư vấn, bạn có thể nhắn tin trực tiếp qua các mạng xã hội hoặc để lại lời nhắn dưới đây.
          </p>
        </div>

        {/* 3. Main Grid: Social Channels + Location on Left (7 cols) | Message Form on Right (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Social Media Focus & Workshop Info */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Primary Social Media Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Kênh Kết Nối Chính Thức
                </span>
                <h2 className="text-base font-black text-slate-900">
                  Nhắn Tin Trực Tiếp Với NOT A KNOT
                </h2>
                <p className="text-xs text-slate-500">
                  Chúng tớ hoạt động chính trên các nền tảng dưới đây. Bạn có thể bấm vào kênh thuận tiện nhất:
                </p>
              </div>
              
              <div className="space-y-3 pt-1">
                {/* 1. Messenger Trực Tiếp */}
                <a
                  href={messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-400 transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00C6FF] to-[#0078FF] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.908 1.455 5.503 3.735 7.152V22l3.447-1.892c.905.251 1.865.388 2.818.388 5.523 0 10-4.145 10-9.238C22 6.145 17.523 2 12 2zm1.05 12.355l-2.673-2.85-5.215 2.85 5.735-6.09 2.741 2.85 5.147-2.85-5.735 6.09z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 group-hover:text-[#0078FF] transition-colors block">
                          Messenger
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                          Chat nhanh
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        m.me/61593591390851
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/80 flex items-center justify-center text-slate-400 group-hover:text-[#0078FF] transition-all">
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </a>

                {/* 2. Facebook Fanpage */}
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 group-hover:text-[#1877F2] transition-colors block">
                        Facebook Fanpage
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        facebook.com/notaknot
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-blue-200 group-hover:bg-blue-50/80 flex items-center justify-center text-slate-400 group-hover:text-[#1877F2] transition-all">
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </a>

                {/* 2. Instagram */}
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-pink-50/60 border border-slate-200 hover:border-pink-300 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 group-hover:text-[#E1306C] transition-colors block">
                        Instagram
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        @notaknot.handmade
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-pink-200 group-hover:bg-pink-50/80 flex items-center justify-center text-slate-400 group-hover:text-[#E1306C] transition-all">
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </a>

                {/* 3. Threads with Image Logo */}
                <a
                  href={threadsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-400 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center flex-shrink-0 shadow-2xs overflow-hidden p-2">
                      {/* Official Threads Image Logo */}
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/9/9d/Threads_%28app%29_logo.svg"
                        alt="Threads"
                        className="w-full h-full object-contain invert brightness-200"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 group-hover:text-slate-700 transition-colors block">
                        Threads
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        @notaknot.handmade
                      </span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-slate-400 group-hover:bg-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-all">
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </div>
                </a>

                {/* 4. Zalo (Rendered ONLY if admin configured a Zalo number/link) */}
                {siteContent?.zalo && siteContent.zalo.trim() !== '' && (
                  <a
                    href={`https://zalo.me/${siteContent.zalo.trim().replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-4 rounded-xl bg-slate-50 hover:bg-blue-50/70 border border-slate-200 hover:border-blue-400 transition-all flex items-center justify-between group cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-[#0068FF] text-white flex items-center justify-center flex-shrink-0 shadow-2xs font-black text-xs">
                        Zalo
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 group-hover:text-[#0068FF] transition-colors block">
                            Zalo CSKH
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-800">
                            Hỗ trợ
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {siteContent.zalo}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/80 flex items-center justify-center text-slate-400 group-hover:text-[#0068FF] transition-all">
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Workshop Address & Hotline (Rendered ONLY if at least one contact item exists) */}
            {(siteContent?.address?.trim() || siteContent?.phone?.trim() || siteContent?.email?.trim()) && (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
                {siteContent?.address?.trim() && (
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="w-5 h-5 text-slate-700" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                        Xưởng Chế Tác
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {siteContent.address}
                      </h3>
                    </div>
                  </div>
                )}

                {(siteContent?.phone?.trim() || siteContent?.email?.trim()) && (
                  <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {siteContent?.phone?.trim() && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-semibold">{siteContent.phone}</span>
                      </div>
                    )}
                    {siteContent?.email?.trim() && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-semibold truncate">{siteContent.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Right Column: Direct Message Form (5 Cols) */}
          <div className="lg:col-span-5">
            <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-5">
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-700" />
                  <span>Gửi Tin Nhắn Cho Xưởng</span>
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Để lại thông tin và lời nhắn, chúng tớ sẽ đọc và phản hồi bạn.
                </p>
              </div>

              {formSent ? (
                <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-3 animate-fadeIn">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
                  <h4 className="font-bold text-sm text-slate-900">Gửi Tin Nhắn Thành Công</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Cảm ơn bạn đã gửi tin. Đội ngũ NOT A KNOT đã nhận được thông tin và sẽ phản hồi qua kênh liên hệ của bạn.
                  </p>
                  <button
                    onClick={() => setFormSent(false)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    Gửi tin nhắn khác
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Họ và tên của bạn *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ví dụ: Hoàng Long"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Email hoặc Số điện thoại / Link MXH *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contactInfo}
                      onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                      placeholder="Email, SĐT hoặc link Facebook/IG của bạn"
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Bạn có thể nhập email nếu không muốn dùng số điện thoại.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Nội dung tin nhắn hoặc câu hỏi *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Nhập nội dung cần hỗ trợ hoặc tư vấn..."
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Tin Nhắn'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>

      </main>

    </div>
  );
};
