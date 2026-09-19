import React, { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  ExternalLink,
  Edit3,
  Copy,
  Check,
  RefreshCw,
  Download,
  Eye,
  SlidersHorizontal,
  Smartphone,
  Monitor,
  HelpCircle,
  FileText,
  Tag,
  Layers,
  ShoppingBag,
  Globe,
  ArrowRight,
  Info,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig } from '../../types';
import { slugify, getProductSlug, getCollectionSlug } from '../../utils/slugify';
import { SITE_DOMAIN } from '../../utils/seo';

export interface SeoAuditItem {
  id: string;
  type: 'product' | 'collection' | 'category' | 'site';
  title: string;
  description: string;
  slug: string;
  url: string;
  image?: string;
  categoryName?: string;
  price?: number;
  status: 'good' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  charCountTitle: number;
  charCountDesc: number;
  rawRef: Product | CollectionInfo | CategoryItem | SiteContentConfig;
}

interface AdminSeoAuditTabProps {
  products: Product[];
  collections?: CollectionInfo[];
  categories?: CategoryItem[];
  siteContent?: SiteContentConfig;
  onUpdateProducts?: (products: Product[]) => void;
  onUpdateCollections?: (collections: CollectionInfo[]) => void;
  onUpdateCategories?: (categories: CategoryItem[]) => void;
  onUpdateSiteContent?: (siteContent: SiteContentConfig) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminSeoAuditTab: React.FC<AdminSeoAuditTabProps> = ({
  products = [],
  collections = [],
  categories = [],
  siteContent,
  onUpdateProducts,
  onUpdateCollections,
  onUpdateCategories,
  onUpdateSiteContent,
  onNotify
}) => {
  // Filters & State
  const [filterType, setFilterType] = useState<'all' | 'product' | 'collection' | 'category' | 'site'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'issues' | 'critical' | 'warning' | 'good' | 'missing_desc' | 'missing_title'>('issues');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<SeoAuditItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Auto-Generate Confirmation Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);

  // Scan & Audit Engine
  const auditResults = useMemo(() => {
    const items: SeoAuditItem[] = [];

    // 1. Audit Products
    products.forEach((prod) => {
      const title = prod.name?.trim() || '';
      const description = prod.description?.trim() || '';
      const prodSlug = getProductSlug(prod);
      const url = `${SITE_DOMAIN}/#product/${prodSlug}`;
      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check Title
      if (!title) {
        issues.push('Thiếu tiêu đề (Title rỗng)');
      } else if (title.length < 15) {
        issues.push(`Tiêu đề quá ngắn (${title.length} ký tự, khuyến nghị: 25-60)`);
        recommendations.push('Bổ sung thêm đặc điểm nổi bật hoặc nhóm đối tượng vào tên sản phẩm');
      } else if (title.length > 75) {
        issues.push(`Tiêu đề quá dài (${title.length} ký tự, có thể bị cắt bớt trên Google)`);
        recommendations.push('Rút gọn tiêu đề dưới 65 ký tự để hiển thị trọn vẹn');
      }

      // Check Description
      if (!description) {
        issues.push('Thiếu thẻ Meta Description (Mô tả sản phẩm trống)');
        recommendations.push('Thêm mô tả từ 120-160 ký tự giới thiệu chất liệu, kiểu dáng và bảo hành');
      } else if (description.length < 60) {
        issues.push(`Mô tả quá ngắn (${description.length} ký tự, khuyến nghị: 120-160)`);
        recommendations.push('Bổ sung thêm chi tiết chất liệu đan tay, quà tặng kèm hoặc chính sách đổi trả');
      } else if (description.length > 320) {
        issues.push(`Mô tả quá dài (${description.length} ký tự, chỉ nên 120-160 cho đoạn tóm tắt SEO)`);
      }

      // Check Image
      if (!prod.image) {
        issues.push('Thiếu ảnh đại diện sản phẩm (OpenGraph / Rich Snippet)');
        recommendations.push('Tải lên ít nhất 1 hình ảnh sản phẩm chất lượng cao');
      }

      // Check Price
      if (!prod.price || prod.price <= 0) {
        issues.push('Chưa cập nhật giá bán hợp lệ');
      }

      let status: 'good' | 'warning' | 'critical' = 'good';
      if (!title || !description || issues.some((i) => i.includes('Thiếu'))) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      items.push({
        id: `prod_${prod.id}`,
        type: 'product',
        title: title || '(Chưa đặt tên sản phẩm)',
        description,
        slug: prodSlug,
        url,
        image: prod.image,
        categoryName: prod.category,
        price: prod.price,
        status,
        issues,
        recommendations,
        charCountTitle: title.length,
        charCountDesc: description.length,
        rawRef: prod
      });
    });

    // 2. Audit Collections & Banners
    collections.forEach((col) => {
      const title = col.title?.trim() || '';
      const description = col.description?.trim() || col.subtitle?.trim() || col.story?.trim() || '';
      const colSlug = getCollectionSlug(col.id);
      const url = `${SITE_DOMAIN}/#collection/${colSlug}`;
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!title) {
        issues.push('Thiếu tiêu đề bộ sưu tập');
      } else if (title.length < 10) {
        issues.push(`Tiêu đề BST ngắn (${title.length} ký tự)`);
      }

      if (!description) {
        issues.push('Thiếu mô tả tóm tắt bộ sưu tập');
        recommendations.push('Thêm mô tả chủ đề, phong cách thiết kế và thông điệp bộ sưu tập');
      } else if (description.length < 50) {
        issues.push(`Mô tả BST quá ngắn (${description.length} ký tự)`);
      }

      if (!col.bgImage && !col.bannerImage) {
        issues.push('Thiếu hình banner bộ sưu tập');
      }

      let status: 'good' | 'warning' | 'critical' = 'good';
      if (!title || !description) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      items.push({
        id: `col_${col.id}`,
        type: 'collection',
        title: title || `Bộ sưu tập ${col.id}`,
        description,
        slug: colSlug,
        url,
        image: col.bgImage || col.bannerImage,
        status,
        issues,
        recommendations,
        charCountTitle: title.length,
        charCountDesc: description.length,
        rawRef: col
      });
    });

    // 3. Audit Categories
    categories.forEach((cat) => {
      if (cat.id === 'all') return;
      const title = cat.label?.trim() || '';
      const description = cat.description?.trim() || cat.introText?.trim() || '';
      const catSlug = slugify(cat.id);
      const url = `${SITE_DOMAIN}/#catalog?category=${catSlug}`;
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!title) {
        issues.push('Thiếu tên danh mục');
      }
      if (!description) {
        issues.push('Thiếu đoạn mô tả giới thiệu danh mục');
        recommendations.push('Bổ sung mô tả ngắn để tối ưu trang chuyên mục khi lên top Google');
      } else if (description.length < 40) {
        issues.push(`Mô tả danh mục quá ngắn (${description.length} ký tự)`);
      }

      let status: 'good' | 'warning' | 'critical' = 'good';
      if (!title || !description) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      items.push({
        id: `cat_${cat.id}`,
        type: 'category',
        title: title || `Danh mục ${cat.id}`,
        description,
        slug: catSlug,
        url,
        image: cat.bannerImage,
        status,
        issues,
        recommendations,
        charCountTitle: title.length,
        charCountDesc: description.length,
        rawRef: cat
      });
    });

    // 4. Audit Global Site Info
    if (siteContent) {
      const brandName = siteContent.brandName?.trim() || '';
      const tagline = siteContent.brandTagline?.trim() || '';
      const siteDesc = siteContent.footer?.aboutBio?.trim() || siteContent.brandTagline?.trim() || '';
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!brandName) issues.push('Thiếu tên thương hiệu toàn trang');
      if (!tagline) issues.push('Thiếu slogan / tagline thương hiệu');
      if (!siteContent.logoUrl) issues.push('Thiếu logo nhận diện thương hiệu');
      if (!siteContent.socialLinks?.facebook && !siteContent.socialLinks?.instagram) {
        issues.push('Thiếu liên kết mạng xã hội chính (Facebook, Instagram) cho Schema.org');
      }

      let status: 'good' | 'warning' | 'critical' = 'good';
      if (!brandName || !tagline) {
        status = 'critical';
      } else if (issues.length > 0) {
        status = 'warning';
      }

      items.push({
        id: 'site_global_meta',
        type: 'site',
        title: brandName ? `${brandName} - ${tagline}` : 'Cấu hình chung Website',
        description: siteDesc,
        slug: '',
        url: SITE_DOMAIN,
        image: siteContent.logoUrl,
        status,
        issues,
        recommendations,
        charCountTitle: (brandName + tagline).length,
        charCountDesc: siteDesc.length,
        rawRef: siteContent
      });
    }

    return items;
  }, [products, collections, categories, siteContent]);

  // Statistics
  const stats = useMemo(() => {
    const total = auditResults.length;
    const critical = auditResults.filter((i) => i.status === 'critical').length;
    const warning = auditResults.filter((i) => i.status === 'warning').length;
    const good = auditResults.filter((i) => i.status === 'good').length;
    const missingDesc = auditResults.filter((i) => !i.description || i.description.length < 30).length;
    const missingTitle = auditResults.filter((i) => !i.title || i.title.startsWith('(')).length;

    // Calculate overall SEO Score out of 100
    // Good: 100%, Warning: 60%, Critical: 0%
    const score = total > 0 ? Math.round(((good * 100 + warning * 60) / (total * 100)) * 100) : 100;

    return {
      total,
      critical,
      warning,
      good,
      missingDesc,
      missingTitle,
      score
    };
  }, [auditResults]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return auditResults.filter((item) => {
      // Type Filter
      if (filterType !== 'all' && item.type !== filterType) return false;

      // Status Filter
      if (filterStatus === 'issues') {
        if (item.status === 'good') return false;
      } else if (filterStatus === 'critical') {
        if (item.status !== 'critical') return false;
      } else if (filterStatus === 'warning') {
        if (item.status !== 'warning') return false;
      } else if (filterStatus === 'good') {
        if (item.status !== 'good') return false;
      } else if (filterStatus === 'missing_desc') {
        if (item.description && item.description.length >= 30) return false;
      } else if (filterStatus === 'missing_title') {
        if (item.title && !item.title.startsWith('(')) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesSlug = item.slug.toLowerCase().includes(q);
        const matchesIssues = item.issues.some((i) => i.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesSlug && !matchesIssues) return false;
      }

      return true;
    });
  }, [auditResults, filterType, filterStatus, searchQuery]);

  // Smart SEO Generator Helper
  const generateOptimizedMeta = (item: SeoAuditItem) => {
    const brand = siteContent?.brandName || 'NOT A KNOT';
    let suggestedTitle = '';
    let suggestedDesc = '';

    if (item.type === 'product') {
      const prod = item.rawRef as Product;
      const cleanName = prod.name?.trim() || 'Vòng Tay Handmade';
      const formattedPrice = prod.price ? `${prod.price.toLocaleString('vi-VN')}đ` : 'Giá ưu đãi';
      const catLabel =
        categories.find((c) => c.id === prod.category)?.label || 'Phụ kiện handmade';

      suggestedTitle = `${cleanName} | ${brand} Handmade`;

      // Compose rich 130-155 character description
      suggestedDesc = `${cleanName} (${catLabel}) chế tác thủ công tinh xảo, dây bện bền đẹp, charm độc bản. Giá chỉ ${formattedPrice}. Bảo hành trọn đời, đổi trả trong 7 ngày toàn quốc.`;
    } else if (item.type === 'collection') {
      const col = item.rawRef as CollectionInfo;
      const colName = col.title || 'Bộ Sưu Tập Mới';
      suggestedTitle = `BST ${colName} - Thiết Kế Độc Quyền | ${brand}`;
      suggestedDesc = `Khám phá Bộ sưu tập ${colName} độc quyền tại ${brand}. Tinh hoa phụ kiện đan tay thủ công cao cấp, tôn vinh phong cách riêng. Giao hàng toàn quốc.`;
    } else if (item.type === 'category') {
      const cat = item.rawRef as CategoryItem;
      const catName = cat.label || 'Danh Mục Sản Phẩm';
      suggestedTitle = `${catName} Cao Cấp - Thủ Công Tinh Xảo | ${brand}`;
      suggestedDesc = `Bộ sưu tập ${catName.toLowerCase()} đẹp mắt, đan tay chỉn chu, mẫu mã đa dạng dành cho học sinh, sinh viên và giới trẻ. Đặt hàng ngay tại ${brand}!`;
    } else {
      suggestedTitle = `${brand} | Phụ Kiện Vòng Tay Handmade Thủ Công Cao Cấp`;
      suggestedDesc = `${brand} - Xưởng chế tác phụ kiện đan tay, vòng tay handmade, móc khóa thời trang độc bản tại Việt Nam. Đan tay tỉ mỉ, bảo hành trọn đời dây và nút thắt.`;
    }

    return {
      title: suggestedTitle,
      description: suggestedDesc,
      slug: slugify(suggestedTitle.split('|')[0].trim())
    };
  };

  // Open Edit Modal
  const handleOpenEdit = (item: SeoAuditItem) => {
    setEditingItem(item);
    setEditTitle(item.title.startsWith('(') ? '' : item.title);
    setEditDescription(item.description);
    setEditSlug(item.slug);
  };

  // Auto-Fill In Edit Modal
  const handleApplySmartSuggestion = () => {
    if (!editingItem) return;
    const suggestion = generateOptimizedMeta(editingItem);
    setEditTitle(suggestion.title);
    setEditDescription(suggestion.description);
    if (!editSlug) {
      setEditSlug(suggestion.slug);
    }
    onNotify?.('Đã tạo gợi ý nội dung chuẩn SEO!', 'info');
  };

  // Save Edit Changes
  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSaving(true);

    try {
      if (editingItem.type === 'product' && onUpdateProducts) {
        const prod = editingItem.rawRef as Product;
        const updated = products.map((p) => {
          if (p.id === prod.id) {
            return {
              ...p,
              name: editTitle.trim() || p.name,
              description: editDescription.trim(),
              slug: editSlug.trim() ? slugify(editSlug) : p.slug
            };
          }
          return p;
        });
        onUpdateProducts(updated);
      } else if (editingItem.type === 'collection' && onUpdateCollections) {
        const col = editingItem.rawRef as CollectionInfo;
        const updated = (collections || []).map((c) => {
          if (c.id === col.id) {
            return {
              ...c,
              title: editTitle.trim() || c.title,
              subtitle: editDescription.trim() || c.subtitle,
              description: editDescription.trim() || c.description
            };
          }
          return c;
        });
        onUpdateCollections(updated);
      } else if (editingItem.type === 'category' && onUpdateCategories) {
        const cat = editingItem.rawRef as CategoryItem;
        const updated = (categories || []).map((c) => {
          if (c.id === cat.id) {
            return {
              ...c,
              label: editTitle.trim() || c.label,
              description: editDescription.trim(),
              introText: editDescription.trim()
            };
          }
          return c;
        });
        onUpdateCategories(updated);
      } else if (editingItem.type === 'site' && onUpdateSiteContent && siteContent) {
        const updated: SiteContentConfig = {
          ...siteContent,
          brandTagline: editTitle.split('-')[1]?.trim() || siteContent.brandTagline,
          footer: {
            ...siteContent.footer,
            aboutBio: editDescription.trim()
          }
        };
        onUpdateSiteContent(updated);
      }

      onNotify?.('Đã lưu thông tin SEO thành công!', 'success');
      setEditingItem(null);
    } catch (err: any) {
      onNotify?.(`Lỗi khi lưu: ${err.message || 'Không thể lưu'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Apply Auto-Generated SEO to all missing items
  const handleExecuteBulkOptimization = async () => {
    setBulkApplying(true);
    let fixedCount = 0;

    try {
      // 1. Fix Products with missing or short descriptions
      if (onUpdateProducts) {
        const updatedProducts = products.map((prod) => {
          const desc = prod.description?.trim() || '';
          const name = prod.name?.trim() || '';
          if (!desc || desc.length < 40 || !prod.slug) {
            fixedCount++;
            const cleanName = name || 'Vòng Tay Handmade NOT A KNOT';
            const catLabel =
              categories.find((c) => c.id === prod.category)?.label || 'Phụ kiện handmade';
            const priceStr = prod.price ? `${prod.price.toLocaleString('vi-VN')}đ` : 'Giá tốt';
            const autoDesc = `${cleanName} (${catLabel}) đan tay thủ công tỉ mỉ, thiết kế trẻ trung độc bản. Giá chỉ ${priceStr}. Bảo hành trọn đời dây và nút thắt.`;

            return {
              ...prod,
              name: cleanName,
              description: desc || autoDesc,
              slug: prod.slug || slugify(cleanName)
            };
          }
          return prod;
        });
        onUpdateProducts(updatedProducts);
      }

      // 2. Fix Categories with missing descriptions
      if (onUpdateCategories && categories.length > 0) {
        const updatedCategories = categories.map((cat) => {
          if (!cat.description || cat.description.length < 30) {
            const autoDesc = `Bộ sưu tập ${cat.label} đan tay thủ công chất lượng cao, bền đẹp và hợp xu hướng giới trẻ.`;
            return {
              ...cat,
              description: autoDesc,
              introText: cat.introText || autoDesc
            };
          }
          return cat;
        });
        onUpdateCategories(updatedCategories);
      }

      onNotify?.(`Đã tự động tối ưu hóa SEO cho ${fixedCount} mục thành công!`, 'success');
      setIsBulkModalOpen(false);
    } catch (err: any) {
      onNotify?.(`Lỗi tối ưu hóa hàng loạt: ${err.message}`, 'error');
    } finally {
      setBulkApplying(false);
    }
  };

  // Export CSV Report
  const handleExportCsv = () => {
    try {
      const headers = ['ID', 'Loai', 'Tieu de (Title)', 'Do dai Title', 'Mo ta (Meta Description)', 'Do dai Desc', 'Trang thai', 'Duong dan URL', 'Cac van de phat hien'];
      const rows = auditResults.map((item) => [
        item.id,
        item.type,
        `"${item.title.replace(/"/g, '""')}"`,
        item.charCountTitle,
        `"${item.description.replace(/"/g, '""')}"`,
        item.charCountDesc,
        item.status === 'good' ? 'Dat chuan' : item.status === 'warning' ? 'Canh bao' : 'Loi nghiem trong',
        item.url,
        `"${item.issues.join('; ').replace(/"/g, '""')}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `NOT_A_KNOT_SEO_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      onNotify?.('Đã xuất báo cáo kiểm tra SEO thành công!', 'success');
    } catch (e: any) {
      onNotify?.('Không thể xuất tệp CSV', 'error');
    }
  };

  // Copy Link Helper
  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    onNotify?.('Đã sao chép đường dẫn!', 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Health Score Badge Color
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 65) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Action Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-400 text-slate-950 font-black shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Kiểm Tra & Tối Ưu SEO Meta
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-400 font-extrabold uppercase tracking-wider">
                  Audit Tool
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Tự động rà soát tiêu đề, thẻ meta description, URL slug và ảnh chia sẻ cho toàn bộ sản phẩm & bộ sưu tập.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95"
            title="Tự động tạo mô tả và tiêu đề chuẩn SEO cho các mục còn thiếu"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tự Động Tối Ưu Hàng Loạt</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border border-slate-200/70 cursor-pointer active:scale-95"
            title="Tải tệp báo cáo CSV"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Báo Cáo CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        {/* Score Card */}
        <div className="col-span-2 md:col-span-2 lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Điểm SEO Tổng Thể
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {stats.score}
              </span>
              <span className="text-xs text-slate-400 font-bold">/ 100</span>
            </div>
          </div>
          <div className={`px-2.5 py-1.5 rounded-xl border font-black text-xs ${getScoreColor(stats.score)}`}>
            {stats.score >= 85 ? 'Hạng A' : stats.score >= 65 ? 'Hạng B' : 'Cần Sửa'}
          </div>
        </div>

        {/* Total Scanned */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Tổng Mục Đã Quét
          </span>
          <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">
            {stats.total}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {products.length} SP · {collections.length} BST · {categories.length} DM
          </span>
        </div>

        {/* Critical Errors */}
        <div
          onClick={() => setFilterStatus('critical')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            filterStatus === 'critical' ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400/30' : 'bg-white border-slate-200/80 hover:bg-rose-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">
              Lỗi Nghiêm Trọng
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-0.5 font-mono">
            {stats.critical}
          </div>
          <span className="text-[10px] text-rose-600/80 font-medium mt-0.5 block">
            Thiếu Title / Description
          </span>
        </div>

        {/* Warnings */}
        <div
          onClick={() => setFilterStatus('warning')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            filterStatus === 'warning' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/30' : 'bg-white border-slate-200/80 hover:bg-amber-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
              Cảnh Báo
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-700 mt-0.5 font-mono">
            {stats.warning}
          </div>
          <span className="text-[10px] text-amber-600/80 font-medium mt-0.5 block">
            Nội dung quá ngắn/dài
          </span>
        </div>

        {/* Good Standard */}
        <div
          onClick={() => setFilterStatus('good')}
          className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all ${
            filterStatus === 'good' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/30' : 'bg-white border-slate-200/80 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
              Đạt Chuẩn SEO
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-0.5 font-mono">
            {stats.good}
          </div>
          <span className="text-[10px] text-emerald-600/80 font-medium mt-0.5 block">
            Sẵn sàng lên top Google
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterStatus('issues')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'issues'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cần Xử Lý ({stats.critical + stats.warning})
            </button>
            <button
              onClick={() => setFilterStatus('missing_desc')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'missing_desc'
                  ? 'bg-rose-500 text-white shadow-xs font-black'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              Thiếu Description ({stats.missingDesc})
            </button>
            <button
              onClick={() => setFilterStatus('critical')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Lỗi Nghiêm Trọng ({stats.critical})
            </button>
            <button
              onClick={() => setFilterStatus('warning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'warning'
                  ? 'bg-amber-500 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cảnh Báo ({stats.warning})
            </button>
            <button
              onClick={() => setFilterStatus('good')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'good'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Đạt Chuẩn ({stats.good})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất Cả ({stats.total})
            </button>
          </div>

          {/* Type Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400">Loại:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-amber-400 cursor-pointer"
            >
              <option value="all">Tất cả mục</option>
              <option value="product">Sản phẩm ({products.length})</option>
              <option value="collection">Bộ sưu tập ({collections.length})</option>
              <option value="category">Danh mục ({categories.length})</option>
              <option value="site">Toàn trang</option>
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, bộ sưu tập, URL slug hoặc vấn đề phát hiện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Main Audit List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800">
              Không tìm thấy mục nào vi phạm điều kiện lọc!
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tất cả các mục trong bộ lọc hiện tại đều đã đạt chuẩn hoặc không khớp với từ khóa tìm kiếm.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isGood = item.status === 'good';
            const isWarning = item.status === 'warning';
            const isCritical = item.status === 'critical';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-xs hover:shadow-md ${
                  isCritical
                    ? 'border-rose-200 bg-rose-50/10'
                    : isWarning
                    ? 'border-amber-200 bg-amber-50/10'
                    : 'border-slate-200/80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Image & Info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-100 shrink-0 overflow-hidden relative">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[9px] font-bold p-1 text-center bg-slate-50">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mb-0.5" />
                          <span>Thiếu ảnh</span>
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Badge Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            item.type === 'product'
                              ? 'bg-sky-100 text-sky-800'
                              : item.type === 'collection'
                              ? 'bg-purple-100 text-purple-800'
                              : item.type === 'category'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {item.type === 'product'
                            ? 'Sản phẩm'
                            : item.type === 'collection'
                            ? 'Bộ sưu tập'
                            : item.type === 'category'
                            ? 'Danh mục'
                            : 'Toàn trang'}
                        </span>

                        {item.categoryName && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {item.categoryName}
                          </span>
                        )}

                        {item.price !== undefined && item.price > 0 && (
                          <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-mono">
                            {item.price.toLocaleString('vi-VN')}đ
                          </span>
                        )}

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isGood
                              ? 'bg-emerald-100 text-emerald-800'
                              : isWarning
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isGood ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Đạt chuẩn
                            </>
                          ) : isWarning ? (
                            <>
                              <AlertTriangle className="w-3 h-3" /> Cảnh báo ({item.issues.length})
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Lỗi ({item.issues.length})
                            </>
                          )}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-black text-slate-900 truncate">
                        {item.title}
                      </h4>

                      {/* URL Snippet */}
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        <span className="truncate max-w-xs sm:max-w-md text-emerald-700">
                          {item.url}
                        </span>
                        <button
                          onClick={() => handleCopyLink(item.url, item.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Sao chép URL"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Description Preview */}
                      <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        {item.description ? (
                          <span>{item.description}</span>
                        ) : (
                          <span className="text-rose-500 font-bold italic flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Thẻ Meta Description đang trống! Cần bổ sung để tăng tỷ lệ click (CTR) trên Google.
                          </span>
                        )}
                      </div>

                      {/* Issues Checklist */}
                      {item.issues.length > 0 && (
                        <div className="pt-1.5 flex flex-wrap gap-1.5">
                          {item.issues.map((issue, idx) => (
                            <span
                              key={idx}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                issue.includes('Thiếu')
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              • {issue}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Quick Actions & Character Counts */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-start gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    <div className="text-right space-y-0.5 hidden sm:block">
                      <div className="text-[10px] text-slate-400">
                        Title: <strong className="text-slate-700 font-mono">{item.charCountTitle}</strong> / 60
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Desc: <strong className={item.charCountDesc < 60 ? 'text-rose-600 font-mono' : 'text-slate-700 font-mono'}>{item.charCountDesc}</strong> / 160
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa & Xem trước</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Edit & Live Google SERP Simulator Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Tối Ưu SEO & Thẻ Meta: {editingItem.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chỉnh sửa trực tiếp tiêu đề và mô tả xuất hiện trên công cụ tìm kiếm Google.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Google SERP Preview Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-slate-500" /> Mô Phỏng Hiển Thị Trên Google Tìm Kiếm
                  </span>

                  {/* Device Toggle */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                        previewDevice === 'desktop' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      <Monitor className="w-3 h-3" /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                        previewDevice === 'mobile' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      <Smartphone className="w-3 h-3" /> Mobile
                    </button>
                  </div>
                </div>

                {/* Google SERP Card */}
                <div
                  className={`p-4 rounded-2xl border border-slate-200 bg-white shadow-xs font-sans space-y-1 ${
                    previewDevice === 'mobile' ? 'max-w-sm mx-auto' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <div className="w-4 h-4 rounded-full bg-slate-900 text-amber-400 text-[9px] font-black flex items-center justify-center shrink-0">
                      N
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-slate-800">NOT A KNOT</span>
                      <span className="text-slate-400 mx-1">›</span>
                      <span className="text-slate-500 text-[11px] font-mono">
                        {editingItem.type} › {editSlug || editingItem.slug || 'san-pham'}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-base text-[#1a0dab] hover:underline font-medium cursor-pointer line-clamp-1 leading-snug">
                    {editTitle || editingItem.title || 'Tiêu đề sản phẩm | NOT A KNOT'}
                  </h4>

                  <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                    {editDescription || editingItem.description || 'Chưa có đoạn mô tả meta description. Hãy nhập để khách hàng tìm thấy bạn dễ dàng hơn trên Google.'}
                  </p>

                  {/* Rich Snippet Preview for Products */}
                  {editingItem.type === 'product' && (
                    <div className="pt-1 flex items-center gap-2 text-[11px] text-[#4d5156]">
                      <span className="text-amber-500 font-bold">★★★★★ 4.9</span>
                      <span>·</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {(editingItem.price || 0).toLocaleString('vi-VN')}đ
                      </span>
                      <span>·</span>
                      <span className="text-emerald-700 font-medium">Còn hàng</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Smart Suggestion Quick Button */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Gợi Ý Chuẩn SEO Tự Động
                  </span>
                  <p className="text-[11px] text-amber-900/80">
                    Tự động tạo tiêu đề và đoạn mô tả 130-155 ký tự chứa từ khóa bán hàng và chính sách.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleApplySmartSuggestion}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition-all shrink-0 cursor-pointer shadow-2xs"
                >
                  Áp Dụng Gợi Ý
                </button>
              </div>

              {/* Form Inputs */}
              <div className="space-y-4">
                {/* Title Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Tiêu Đề SEO (SEO Title)
                    </label>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        editTitle.length > 70
                          ? 'text-rose-600'
                          : editTitle.length >= 25
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {editTitle.length} / 60 ký tự
                    </span>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Ví dụ: Vòng Tay Handmade May Mắn | NOT A KNOT"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Khuyến nghị từ 30 đến 60 ký tự để Google không cắt ngắn tiêu đề.
                  </p>
                </div>

                {/* Description Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Thẻ Mô Tả (Meta Description)
                    </label>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        editDescription.length > 165
                          ? 'text-rose-600'
                          : editDescription.length >= 100
                          ? 'text-emerald-600'
                          : editDescription.length > 0
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                    >
                      {editDescription.length} / 160 ký tự
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Mô tả tóm tắt sản phẩm chứa từ khóa chính, chất liệu, ưu đãi bảo hành và kêu gọi đặt hàng..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:border-amber-400 leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-400">
                    Độ dài lý tưởng: 120-160 ký tự. Cung cấp thông tin đầy đủ, rõ ràng và hấp dẫn người đọc.
                  </p>
                </div>

                {/* Slug Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Đường Dẫn URL Slug
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono">https://www.notaknot.id.vn/#.../</span>
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(slugify(e.target.value))}
                      placeholder="vong-tay-handmade-may-man"
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi SEO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Auto-Generate Confirmation Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">
                Tự Động Tối Ưu Hóa SEO Hàng Loạt?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hệ thống sẽ quét toàn bộ {stats.missingDesc} mục đang thiếu hoặc có mô tả quá ngắn, tự động tạo mô tả chuẩn 130-155 ký tự với đầy đủ thông tin danh mục, giá bán và bảo hành.
              </p>
            </div>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-600" /> Lưu ý an toàn:
              </div>
              <p className="text-[11px] text-amber-800 leading-normal">
                Các sản phẩm đã có mô tả hoàn chỉnh sẽ được giữ nguyên không thay đổi.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={bulkApplying}
                onClick={handleExecuteBulkOptimization}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {bulkApplying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{bulkApplying ? 'Đang tạo...' : 'Bắt Đầu Tối Ưu'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
