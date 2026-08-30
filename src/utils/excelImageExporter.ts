import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage } from '../types';
import { StoredOrder } from '../firebase';

// Helper to fetch an image and return { data: Blob | ArrayBuffer, extension: string }
async function fetchImageBlob(url: string): Promise<{ data: Blob; extension: string } | null> {
  try {
    if (!url) return null;

    // Handle Data URL (Base64)
    if (url.startsWith('data:image/')) {
      const mimeType = url.substring(url.indexOf(':') + 1, url.indexOf(';'));
      const ext = mimeType.split('/')[1] || 'png';
      const res = await fetch(url);
      const blob = await res.blob();
      return { data: blob, extension: ext };
    }

    // Handle URL (relative or absolute)
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    
    // Determine extension
    let ext = 'jpg';
    if (blob.type.includes('png')) ext = 'png';
    else if (blob.type.includes('webp')) ext = 'webp';
    else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';
    else if (url.endsWith('.png')) ext = 'png';
    else if (url.endsWith('.webp')) ext = 'webp';

    return { data: blob, extension: ext };
  } catch (err) {
    console.warn('Không thể tải ảnh cho file export:', url, err);
    return null;
  }
}

// Sanitize filenames for safe zip entries
function sanitizeFilename(name: string): string {
  return (name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 50);
}

/**
 * 1. Export Orders Table to Excel (with optional ZIP image bundle)
 */
export async function exportOrdersWithImageOption({
  orders,
  products = [],
  includeImages = false,
  onProgress
}: {
  orders: StoredOrder[];
  products?: Product[];
  includeImages: boolean;
  onProgress?: (statusText: string) => void;
}): Promise<void> {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  onProgress?.('Đang kết xuất bảng tính Excel...');

  const excelData = orders.map((o, idx) => {
    const pm =
      o.paymentMethod === 'bank_transfer'
        ? 'Chuyển khoản (VietQR)'
        : o.paymentMethod === 'cash'
        ? 'Tiền mặt'
        : 'Thu COD khi giao';
    const ps = o.paymentStatus === 'paid' ? 'Đã thanh toán' : o.paymentStatus === 'partial' ? 'Đặt cọc' : 'Chưa thanh toán';
    const hasBill = o.bankReceiptImage ? 'Có ảnh bill CK' : 'Chưa có';
    const paid = o.paidAmount ?? (o.paymentStatus === 'paid' ? (o.totalPrice || o.totalAmount || 0) : 0);
    const itemsStr =
      o.itemDetails && o.itemDetails.length > 0
        ? o.itemDetails.map((it) => `${it.productName} (x${it.quantity})${it.customNote ? ` [${it.customNote}]` : ''}`).join(', ')
        : (o.items || []).join(', ');

    return {
      'STT': idx + 1,
      'Mã Đơn Hàng': o.id || `ORD-${idx + 1}`,
      'Thời Gian Đặt': o.date || o.createdAt || '',
      'Tên Khách Hàng': o.name || o.customerName || '',
      'Số Điện Thoại': o.phone || '',
      'Địa Chỉ Giao Hàng': o.address || '',
      'Sản Phẩm & Số Lượng': itemsStr,
      'Tổng Tiền (VNĐ)': o.totalPrice || o.totalAmount || 0,
      'Đã Thu (VNĐ)': paid,
      'Nguồn Đơn': o.source || 'website',
      'Hình Thức TT': pm,
      'Tình Trạng TT': ps,
      'Mã GD Ngân Hàng': o.bankTransferRef || '',
      'Bill Chuyển Khoản': hasBill,
      'Trạng Thái Xử Lý': o.status || 'Đã đặt',
      'Ghi Chú': o.note || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 22 }, // Mã Đơn Hàng
    { wch: 22 }, // Thời Gian Đặt
    { wch: 22 }, // Tên Khách Hàng
    { wch: 15 }, // Số Điện Thoại
    { wch: 36 }, // Địa Chỉ Giao Hàng
    { wch: 42 }, // Sản Phẩm & Số Lượng
    { wch: 16 }, // Tổng Tiền
    { wch: 16 }, // Đã Thu
    { wch: 14 }, // Nguồn Đơn
    { wch: 24 }, // Hình Thức TT
    { wch: 20 }, // Tình Trạng TT
    { wch: 18 }, // Mã GD
    { wch: 18 }, // Bill CK
    { wch: 18 }, // Trạng Thái Xử Lý
    { wch: 32 }  // Ghi Chú
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Sách Đơn Hàng');

  // If user does NOT want images, download .xlsx directly
  if (!includeImages) {
    XLSX.writeFile(workbook, `NOT_A_KNOT_Don_Hang_${dateStr}.xlsx`);
    return;
  }

  // If user requested images, package Excel + Images into a ZIP
  onProgress?.('Đang thu thập và nén hình ảnh bill & sản phẩm...');
  const zip = new JSZip();

  // 1. Add Excel file to ZIP
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  zip.file(`NOT_A_KNOT_Don_Hang_${dateStr}.xlsx`, excelBuffer);

  // 2. Fetch and add Receipt Bills folder
  const billFolder = zip.folder('Anh_Bill_Chuyen_Khoan');
  let billCount = 0;
  for (let i = 0; i < orders.length; i++) {
    const ord = orders[i];
    if (ord.bankReceiptImage) {
      onProgress?.(`Đang tải ảnh bill ${i + 1}/${orders.length}...`);
      const imgObj = await fetchImageBlob(ord.bankReceiptImage);
      if (imgObj && billFolder) {
        const safeId = sanitizeFilename(ord.id || `ORD_${i + 1}`);
        billFolder.file(`Bill_Don_${safeId}.${imgObj.extension}`, imgObj.data);
        billCount++;
      }
    }
  }

  // 3. Fetch and add Product Images folder
  if (products && products.length > 0) {
    const prodFolder = zip.folder('Anh_San_Pham');
    let prodImgCount = 0;
    for (const p of products) {
      if (p.image) {
        const imgObj = await fetchImageBlob(p.image);
        if (imgObj && prodFolder) {
          const safeName = sanitizeFilename(`${p.id}_${p.name}`);
          prodFolder.file(`${safeName}.${imgObj.extension}`, imgObj.data);
          prodImgCount++;
        }
      }
    }
  }

  onProgress?.('Đang hoàn tất đóng gói file ZIP...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `NOT_A_KNOT_Don_Hang_Kem_Anh_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

/**
 * 2. Export Multi-Sheet Master Backup to Excel (with optional ZIP image bundle)
 */
export async function exportMasterBackupWithImageOption({
  orders,
  products,
  categories,
  collections,
  siteContent,
  selectedTypes,
  includeImages = false,
  onProgress
}: {
  orders: StoredOrder[];
  products: Product[];
  categories: CategoryItem[];
  collections: CollectionInfo[];
  siteContent?: SiteContentConfig;
  selectedTypes: {
    orders: boolean;
    products: boolean;
    categories: boolean;
    banners: boolean;
    siteContent: boolean;
    messages: boolean;
  };
  includeImages: boolean;
  onProgress?: (statusText: string) => void;
}): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10);
  onProgress?.('Đang tạo các bảng dữ liệu Excel...');

  const workbook = XLSX.utils.book_new();

  // Sheet 1: Orders
  if (selectedTypes.orders && orders.length > 0) {
    const orderRows = orders.map((o, idx) => {
      const itemsText = o.itemDetails && o.itemDetails.length > 0
        ? o.itemDetails.map(it => `${it.productName} (SL: ${it.quantity || 1})`).join('; ')
        : (o.items || []).join('; ');

      return {
        'STT': idx + 1,
        'Mã Đơn': o.id || `ORD-${idx + 1}`,
        'Ngày Đặt': o.date || o.createdAt || '',
        'Khách Hàng': o.name || o.customerName || '',
        'SĐT': o.phone || '',
        'Địa Chỉ': o.address || '',
        'Sản Phẩm': itemsText,
        'Tổng Tiền': o.totalPrice || o.totalAmount || 0,
        'Đã Thu': o.paidAmount || (o.paymentStatus === 'paid' ? (o.totalPrice || o.totalAmount || 0) : 0),
        'Trạng Thái': o.status || 'Đã đặt',
        'Thanh Toán': o.paymentStatus || 'unpaid',
        'Phương Thức': o.paymentMethod || 'vietqr',
        'Nguồn Đơn': o.source || 'website',
        'Có Bill CK': o.bankReceiptImage ? 'Có' : 'Không',
        'Ghi Chú': o.note || ''
      };
    });
    const wsOrders = XLSX.utils.json_to_sheet(orderRows);
    XLSX.utils.book_append_sheet(workbook, wsOrders, '1. Đơn Hàng');
  }

  // Sheet 2: Products
  if (selectedTypes.products && products.length > 0) {
    const productRows = products.map((p, idx) => ({
      'STT': idx + 1,
      'Mã SP (ID)': p.id,
      'Tên Sản Phẩm': p.name,
      'Danh Mục': p.category,
      'Giá Bán (VNĐ)': p.price,
      'Giá Gốc (VNĐ)': p.originalPrice || '',
      'Tồn Kho': p.stock ?? 15,
      'Còn Hàng': p.inStock !== false ? 'Còn hàng' : 'Hết hàng',
      'Nhãn Giảm Giá': p.discountBadge || '',
      'BST 02.09': p.isEvent0209 ? 'Có' : 'Không',
      'Best Seller': p.isBestSeller ? 'Có' : 'Không',
      'Sản Phẩm Mới': p.isNew ? 'Có' : 'Không',
      'Mô Tả': p.description || '',
      'Thông Số Chi Tiết': Array.isArray(p.details) ? p.details.join(' | ') : '',
      'Đường Dẫn Ảnh': p.image || ''
    }));
    const wsProducts = XLSX.utils.json_to_sheet(productRows);
    XLSX.utils.book_append_sheet(workbook, wsProducts, '2. Sản Phẩm & Kho');
  }

  // Sheet 3: Categories
  if (selectedTypes.categories && categories.length > 0) {
    const categoryRows = categories.map((c, idx) => ({
      'STT': idx + 1,
      'Mã Danh Mục (ID)': c.id,
      'Tên Danh Mục': c.label,
      'Màu Nổi Bật': c.highlightColor || '',
      'Badge Nhãn': c.badge || '',
      'Mô Tả': c.description || ''
    }));
    const wsCategories = XLSX.utils.json_to_sheet(categoryRows);
    XLSX.utils.book_append_sheet(workbook, wsCategories, '3. Danh Mục');
  }

  // Sheet 4: Collections & Banners
  if (selectedTypes.banners && collections.length > 0) {
    const collectionRows = collections.map((b, idx) => ({
      'STT': idx + 1,
      'Mã BST (ID)': b.id,
      'Tiêu Đề': b.title,
      'Tag Nhãn': b.tag || '',
      'Điểm Nhấn': b.highlight || '',
      'Mô Tả Phụ': b.subtitle || '',
      'Là Đặt Trước (Pre-order)': b.isPreorder ? 'Có' : 'Không',
      'Thứ Tự Hiển Thị': b.order || idx + 1,
      'Ảnh Banner': b.bannerImage || b.bgImage || ''
    }));
    const wsCollections = XLSX.utils.json_to_sheet(collectionRows);
    XLSX.utils.book_append_sheet(workbook, wsCollections, '4. Bộ Sưu Tập');
  }

  // Sheet 5: Site Configuration
  if (selectedTypes.siteContent && siteContent) {
    const siteRows = [
      { 'Thuộc Tính': 'Tên Thương Hiệu', 'Giá Trị': siteContent.brandName || '' },
      { 'Thuộc Tính': 'Slogan / Tagline', 'Giá Trị': siteContent.brandTagline || '' },
      { 'Thuộc Tính': 'Thông Báo Đầu Trang', 'Giá Trị': siteContent.announcementText || '' },
      { 'Thuộc Tính': 'Bật Thông Báo', 'Giá Trị': siteContent.announcementActive ? 'BẬT' : 'TẮT' },
      { 'Thuộc Tính': 'Số Điện Thoại Hotline', 'Giá Trị': siteContent.phone || '' },
      { 'Thuộc Tính': 'Zalo CSKH', 'Giá Trị': siteContent.zalo || '' },
      { 'Thuộc Tính': 'Địa Chỉ Xưởng', 'Giá Trị': siteContent.address || '' },
      { 'Thuộc Tính': 'Email Liên Hệ', 'Giá Trị': siteContent.email || '' },
      { 'Thuộc Tính': 'Facebook Link', 'Giá Trị': siteContent.socialLinks?.facebook || '' },
      { 'Thuộc Tính': 'Instagram Link', 'Giá Trị': siteContent.socialLinks?.instagram || '' },
      { 'Thuộc Tính': 'Threads Link', 'Giá Trị': siteContent.socialLinks?.threads || '' }
    ];
    const wsSite = XLSX.utils.json_to_sheet(siteRows);
    XLSX.utils.book_append_sheet(workbook, wsSite, '5. Cấu Hình Website');
  }

  // If user only wanted Excel, write immediately
  if (!includeImages) {
    XLSX.writeFile(workbook, `NOT_A_KNOT_Master_Spreadsheet_${dateStr}.xlsx`);
    return;
  }

  // Package Excel + Organized Folders of Images
  onProgress?.('Đang tải và nén tất cả hình ảnh hệ thống (Sản phẩm, Banners, Bill)...');
  const zip = new JSZip();

  // Add Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  zip.file(`NOT_A_KNOT_Master_Spreadsheet_${dateStr}.xlsx`, excelBuffer);

  // 1. Products images
  if (selectedTypes.products && products.length > 0) {
    const prodFolder = zip.folder('1_Anh_San_Pham');
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (p.image) {
        onProgress?.(`Đang tải ảnh sản phẩm ${i + 1}/${products.length}...`);
        const imgObj = await fetchImageBlob(p.image);
        if (imgObj && prodFolder) {
          const safeName = sanitizeFilename(`${p.id}_${p.name}`);
          prodFolder.file(`${safeName}.${imgObj.extension}`, imgObj.data);
        }
      }
      // Additional photos if any
      if (p.images && p.images.length > 1) {
        for (let imgIdx = 1; imgIdx < p.images.length; imgIdx++) {
          const extraImg = p.images[imgIdx];
          const imgObj = await fetchImageBlob(extraImg);
          if (imgObj && prodFolder) {
            const safeName = sanitizeFilename(`${p.id}_${p.name}_phu_${imgIdx}`);
            prodFolder.file(`${safeName}.${imgObj.extension}`, imgObj.data);
          }
        }
      }
    }
  }

  // 2. Order receipt bills
  if (selectedTypes.orders && orders.length > 0) {
    const billFolder = zip.folder('2_Anh_Bill_Don_Hang');
    for (let i = 0; i < orders.length; i++) {
      const ord = orders[i];
      if (ord.bankReceiptImage) {
        onProgress?.(`Đang tải bill chuyển khoản đơn #${ord.id || i + 1}...`);
        const imgObj = await fetchImageBlob(ord.bankReceiptImage);
        if (imgObj && billFolder) {
          const safeId = sanitizeFilename(ord.id || `ORD_${i + 1}`);
          billFolder.file(`Bill_Don_${safeId}.${imgObj.extension}`, imgObj.data);
        }
      }
    }
  }

  // 3. Collection Banners
  if (selectedTypes.banners && collections.length > 0) {
    const bannerFolder = zip.folder('3_Anh_Banner_BST');
    for (let i = 0; i < collections.length; i++) {
      const b = collections[i];
      const targetImg = b.bannerImage || b.bgImage || b.horizontalImage;
      if (targetImg) {
        const imgObj = await fetchImageBlob(targetImg);
        if (imgObj && bannerFolder) {
          const safeTitle = sanitizeFilename(`${b.id}_${b.title}`);
          bannerFolder.file(`${safeTitle}.${imgObj.extension}`, imgObj.data);
        }
      }
    }
  }

  // 4. Logo website
  if (selectedTypes.siteContent && siteContent?.logoUrl) {
    const logoImg = await fetchImageBlob(siteContent.logoUrl);
    if (logoImg) {
      zip.file(`Logo_Thuong_Hieu.${logoImg.extension}`, logoImg.data);
    }
  }

  onProgress?.('Đang nén file ZIP hoàn tất...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `NOT_A_KNOT_Backup_Kem_Anh_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
