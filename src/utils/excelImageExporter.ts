import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { Product, CategoryItem, CollectionInfo, SiteContentConfig, ContactMessage } from '../types';
import { StoredOrder } from '../firebase';
import { getCleanOrderNote } from './orderFormatters';

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

// Ensure cell string content does not exceed Excel's strict limit of 32,767 characters
export function safeCellText(val: any, maxLength = 32000): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return isNaN(val) ? '' : String(val);
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  
  let str = typeof val === 'string' ? val : String(val);
  
  // If string is a large Base64 image Data URL, replace with a clear informative note
  if (str.startsWith('data:image/')) {
    return '[Dữ liệu ảnh Base64 - Đã lưu kèm trong file ZIP]';
  }
  
  // Excel hard limit is 32,767 characters. Truncate safely before limit.
  if (str.length > maxLength) {
    return str.slice(0, maxLength) + '... [Đã rút gọn do giới hạn 32.767 ký tự của ô Excel]';
  }
  return str;
}

// Helper to format full product name with all customer-selected variations & options
function formatOrderItemFullNameAndOptions(it: any): string {
  if (!it) return '';
  const baseName = it.productName || it.name || 'Sản phẩm';
  const optionsParts: string[] = [];

  if (it.selectedColor) {
    optionsParts.push(`Màu: ${it.selectedColor}`);
  }

  if (it.selectedCharm) {
    const charmName = typeof it.selectedCharm === 'object' ? (it.selectedCharm.name || '') : String(it.selectedCharm);
    if (charmName) {
      optionsParts.push(`Charm: ${charmName}${it.selectedCharmPrice ? ` (+${it.selectedCharmPrice.toLocaleString('vi-VN')}đ)` : ''}`);
    }
  } else if (Array.isArray(it.selectedCharms) && it.selectedCharms.length > 0) {
    const charmNames = it.selectedCharms.map((c: any) => typeof c === 'object' ? (c.name || '') : String(c)).filter(Boolean).join(', ');
    if (charmNames) {
      optionsParts.push(`Charm: ${charmNames}`);
    }
  }

  if (it.selectedKhoen) {
    optionsParts.push(`Khoen: ${it.selectedKhoen}${it.selectedKhoenPrice ? ` (+${it.selectedKhoenPrice.toLocaleString('vi-VN')}đ)` : ''}`);
  }

  if (Array.isArray(it.selectedOmamoris) && it.selectedOmamoris.length > 0) {
    const omamoriNames = it.selectedOmamoris.map((o: any) => typeof o === 'object' ? (o.name || '') : String(o)).filter(Boolean).join(', ');
    if (omamoriNames) {
      optionsParts.push(`Bùa Omamori: ${omamoriNames}${it.selectedOmamoriPrice ? ` (+${it.selectedOmamoriPrice.toLocaleString('vi-VN')}đ)` : ''}`);
    }
  }

  if (it.selectedSize) {
    optionsParts.push(`Size: ${it.selectedSize}`);
  }

  if (Array.isArray(it.selectedComboItems) && it.selectedComboItems.length > 0) {
    const comboDesc = it.selectedComboItems.map((c: any, i: number) => {
      const cParts = [];
      if (c.selectedColor) cParts.push(`Màu: ${c.selectedColor}`);
      if (Array.isArray(c.selectedCharms) && c.selectedCharms.length > 0) {
        cParts.push(`Charm: ${c.selectedCharms.map((ch: any) => typeof ch === 'object' ? ch.name : ch).join(', ')}`);
      }
      if (Array.isArray(c.selectedOmamoris) && c.selectedOmamoris.length > 0) {
        cParts.push(`Bùa: ${c.selectedOmamoris.map((om: any) => typeof om === 'object' ? om.name : om).join(', ')}`);
      }
      if (c.selectedKhoen) cParts.push(`Khoen: ${c.selectedKhoen}`);
      if (c.selectedSize) cParts.push(`Size: ${c.selectedSize}`);
      return `[${c.itemTitle || `Món ${i + 1}`}: ${cParts.join(' | ')}]`;
    }).join(' + ');
    optionsParts.push(`Combo: ${comboDesc}`);
  }

  if (it.customKnotColor) {
    optionsParts.push(`Màu nút: ${it.customKnotColor}`);
  }

  if (it.customNote) {
    optionsParts.push(`Yêu cầu riêng: ${it.customNote}`);
  }

  if (optionsParts.length > 0) {
    return `${baseName} (${optionsParts.join(' | ')})`;
  }
  return baseName;
}

/**
 * Helper to build styled Orders worksheet matching the exact template:
 * - Header Row (Row 1): Background #3B608D, Font: Bold, size 11, White (#FFFFFF), Height: 26, vertical & horizontal center
 * - Columns: STT, Mã Đơn Hàng, Thời Gian Đặt, Tên Khách Hàng, Số Điện Thoại, Địa Chỉ, Sản Phẩm, Số Lượng, Đơn giá, Tổng Tiền, Đã Thu (VNĐ), Nguồn Đơn, Tình Trạng TT, Hình Thức TT, Bill Chuyển Khoản, Trạng Thái Xử Lý, Ghi Chú, Người bán
 * - Wherever there is no information for a cell, leave it blank
 * - Conditional Cell Colors:
 *   Nguồn Đơn: 'Trực tiếp' → #D2DAE4, 'Website' → #FBD4B4, 'MXH' → #F2DBDB
 *   Tình Trạng TT: 'Đã thanh toán' → #748C42 (Font #C2D69B Bold), 'Chưa thanh toán' → #D99594 (Font #000000)
 * - Borders & Alignment: Thin light gray border (#E0E0E0) on all populated cells, right-align numeric columns
 */
export function buildStyledOrdersWorksheet(orders: StoredOrder[]): any {
  const headers = [
    'STT',
    'Mã Đơn Hàng',
    'Thời Gian Đặt',
    'Tên Khách Hàng',
    'Số Điện Thoại',
    'Địa Chỉ',
    'Sản Phẩm',
    'Số Lượng',
    'Đơn giá',
    'Tổng Tiền',
    'Đã Thu (VNĐ)',
    'Nguồn Đơn',
    'Tình Trạng TT',
    'Hình Thức TT',
    'Bill Chuyển Khoản',
    'Trạng Thái Xử Lý',
    'Ghi Chú',
    'Người bán'
  ];

  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'E0E0E0' } },
    bottom: { style: 'thin', color: { rgb: 'E0E0E0' } },
    left: { style: 'thin', color: { rgb: 'E0E0E0' } },
    right: { style: 'thin', color: { rgb: 'E0E0E0' } }
  };

  const rows: (string | number)[][] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const rowMetas: { sourceText: string; paymentStatusText: string }[] = [];

  orders.forEach((o, idx) => {
    // 1. STT
    const stt = idx + 1;

    // 2. Mã Đơn Hàng
    const orderId = safeCellText(o.id || '');
    const safeId = sanitizeFilename(o.id || `ORD_${idx + 1}`);

    // 3. Thời Gian Đặt
    const orderTime = safeCellText(o.date || o.createdAt || '');

    // 4. Tên Khách Hàng
    const customerName = safeCellText(o.name || o.customerName || '');

    // 5. Số Điện Thoại
    const phone = safeCellText(o.phone || '');

    // 6. Địa Chỉ
    const address = safeCellText(o.address || '');

    // Order Totals
    const orderTotal = typeof o.totalPrice === 'number' ? o.totalPrice : typeof o.totalAmount === 'number' ? o.totalAmount : '';

    // Paid amount calculation
    const pStatus = String(o.paymentStatus || '').toLowerCase();
    const isPaid = pStatus === 'paid' || pStatus.includes('đã thanh toán');

    let orderPaid: number | '' = '';
    if (typeof o.paidAmount === 'number') {
      orderPaid = o.paidAmount;
    } else if (isPaid) {
      orderPaid = orderTotal !== '' ? orderTotal : 0;
    } else if (orderTotal !== '') {
      orderPaid = 0;
    }

    // 12. Nguồn Đơn: 'Trực tiếp' | 'Website' | 'MXH'
    const rawSource = (o.source || 'website').toLowerCase().trim();
    let sourceText = 'Website';
    if (['trực tiếp', 'truc tiep', 'offline', 'hotline', 'phone', 'direct', 'store', 'other', 'cash'].includes(rawSource)) {
      sourceText = 'Trực tiếp';
    } else if (['mxh', 'mạng xã hội', 'mang xa hoi', 'facebook', 'fb', 'tiktok', 'instagram', 'zalo', 'social'].includes(rawSource)) {
      sourceText = 'MXH';
    } else {
      sourceText = 'Website';
    }

    // 13. Tình Trạng TT: 'Đã thanh toán' | 'Chưa thanh toán'
    const paymentStatusText = isPaid ? 'Đã thanh toán' : 'Chưa thanh toán';

    // 14. Hình Thức TT
    const pMethod = String(o.paymentMethod || '').toLowerCase();
    let paymentMethodText = '';
    if (pMethod === 'bank_transfer' || pMethod === 'vietqr' || pMethod.includes('chuyển khoản')) {
      paymentMethodText = 'Chuyển khoản (VietQR)';
    } else if (pMethod === 'cash' || pMethod.includes('tiền mặt')) {
      paymentMethodText = 'Tiền mặt';
    } else if (pMethod === 'cod' || pMethod.includes('cod')) {
      paymentMethodText = 'Thu COD khi giao';
    } else if (o.paymentMethod) {
      paymentMethodText = safeCellText(o.paymentMethod);
    }

    // 15. Bill Chuyển Khoản: display exact filename such as Bill_Don_ord-man-1788370328910
    const billText = o.bankReceiptImage ? `Bill_Don_${safeId}` : '';

    // 16. Trạng Thái Xử Lý
    const statusText = safeCellText(o.status || 'Đã đặt');

    // 17. Ghi Chú
    const noteText = safeCellText(getCleanOrderNote(o.note));

    // 18. Người bán
    const sellerText = safeCellText(o.sellerName || o.sellerId || '');

    // Extract individual product lines
    interface ExtractedItem {
      name: string;
      quantity: number | '';
      unitPrice: number | '';
    }

    const items: ExtractedItem[] = [];

    if (o.itemDetails && o.itemDetails.length > 0) {
      o.itemDetails.forEach((it) => {
        const pName = safeCellText(formatOrderItemFullNameAndOptions(it));
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        let price: number | '' = '';
        if (typeof it.price === 'number' && it.price >= 0) {
          price = it.price;
        } else if (typeof (it as any).unitPrice === 'number' && (it as any).unitPrice >= 0) {
          price = (it as any).unitPrice;
        } else if (o.itemDetails!.length === 1 && typeof orderTotal === 'number') {
          price = Math.round(orderTotal / qty);
        }
        items.push({ name: pName, quantity: qty, unitPrice: price });
      });
    } else if (o.items && o.items.length > 0) {
      o.items.forEach((itStr) => {
        const match = itStr.match(/^(.*?)\s*\(x(\d+)\)(.*)$/);
        if (match) {
          const pName = safeCellText((match[1] + (match[3] || '')).trim());
          const qty = parseInt(match[2], 10) || 1;
          items.push({ name: pName, quantity: qty, unitPrice: '' });
        } else {
          items.push({ name: safeCellText(itStr), quantity: 1, unitPrice: '' });
        }
      });
      if (items.length === 1 && items[0].unitPrice === '' && typeof orderTotal === 'number' && typeof items[0].quantity === 'number') {
        items[0].unitPrice = Math.round(orderTotal / items[0].quantity);
      }
    } else {
      items.push({ name: '', quantity: '', unitPrice: '' });
    }

    const numItems = items.length;
    const startRowIndex = rows.length + 1; // Row index in Excel (1-based, headers is row 0)

    if (numItems > 1) {
      const endRowIndex = startRowIndex + numItems - 1;
      const MERGED_COLUMNS = [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15, 16, 17];
      MERGED_COLUMNS.forEach((colIdx) => {
        merges.push({
          s: { r: startRowIndex, c: colIdx },
          e: { r: endRowIndex, c: colIdx }
        });
      });
    }

    items.forEach((item, itemIdx) => {
      const isFirstItem = itemIdx === 0;

      // Customer & Order identifiers on the first item line only (merged across order rows)
      const cellStt = isFirstItem ? stt : '';
      const cellOrderId = isFirstItem ? orderId : '';
      const cellOrderTime = isFirstItem ? orderTime : '';
      const cellCustomerName = isFirstItem ? customerName : '';
      const cellPhone = isFirstItem ? phone : '';
      const cellAddress = isFirstItem ? address : '';

      // Product line data (individual line per item)
      const cellProdName = item.name;
      const cellQuantity = item.quantity;
      const cellUnitPrice = item.unitPrice;

      // Total Price & Paid Amount: placed on the first item row, which is the anchor cell for the merged range
      const cellTotal = isFirstItem ? orderTotal : '';
      const cellPaid = isFirstItem ? (orderPaid !== '' ? orderPaid : (orderTotal !== '' ? 0 : '')) : '';

      // Order status / metadata only on the first item line (merged across order rows)
      const cellSource = isFirstItem ? sourceText : '';
      const cellPaymentStatus = isFirstItem ? paymentStatusText : '';
      const cellPaymentMethod = isFirstItem ? paymentMethodText : '';
      const cellBill = isFirstItem ? billText : '';
      const cellStatus = isFirstItem ? statusText : '';
      const cellNote = isFirstItem ? noteText : '';
      const cellSeller = isFirstItem ? sellerText : '';

      rows.push([
        cellStt,
        cellOrderId,
        cellOrderTime,
        cellCustomerName,
        cellPhone,
        cellAddress,
        cellProdName,
        cellQuantity,
        cellUnitPrice,
        cellTotal,
        cellPaid,
        cellSource,
        cellPaymentStatus,
        cellPaymentMethod,
        cellBill,
        cellStatus,
        cellNote,
        cellSeller
      ]);

      rowMetas.push({
        sourceText,
        paymentStatusText
      });
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Enable AutoFilter (Sort and Filter dropdowns) on the table header row
  if (worksheet['!ref']) {
    worksheet['!autofilter'] = { ref: worksheet['!ref'] };
  }

  if (merges.length > 0) {
    worksheet['!merges'] = merges;
  }

  // Set Row Heights: Header row height = 26; Data rows = 22
  const rowHeights: { hpt: number }[] = [{ hpt: 26 }];
  for (let i = 0; i < rows.length; i++) {
    rowHeights.push({ hpt: 22 });
  }
  worksheet['!rows'] = rowHeights;

  // Set Column Widths
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 18 }, // Mã Đơn Hàng
    { wch: 20 }, // Thời Gian Đặt
    { wch: 24 }, // Tên Khách Hàng
    { wch: 14 }, // Số Điện Thoại
    { wch: 38 }, // Địa Chỉ
    { wch: 36 }, // Sản Phẩm
    { wch: 10 }, // Số Lượng
    { wch: 14 }, // Đơn giá
    { wch: 16 }, // Tổng Tiền
    { wch: 16 }, // Đã Thu (VNĐ)
    { wch: 14 }, // Nguồn Đơn
    { wch: 18 }, // Tình Trạng TT
    { wch: 24 }, // Hình Thức TT
    { wch: 34 }, // Bill Chuyển Khoản
    { wch: 18 }, // Trạng Thái Xử Lý
    { wch: 30 }, // Ghi Chú
    { wch: 18 }  // Người bán
  ];

  // Header Row Styling: Background #3B608D, Font: Bold, size 11, White (#FFFFFF), Height: 26, Center/Center, Border #E0E0E0
  headers.forEach((_, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = {
        fill: { fgColor: { rgb: '3B608D' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border: thinBorder
      };
    }
  });

  // Data Rows Styling & Conditional Colors
  rows.forEach((row, rowIdx) => {
    const r = rowIdx + 1;
    row.forEach((val, c) => {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!worksheet[cellRef]) {
        worksheet[cellRef] = { t: 's', v: '' };
      }

      const cell = worksheet[cellRef];
      // Numeric columns (Số Lượng, Đơn giá, Tổng Tiền, Đã Thu): cols 7, 8, 9, 10
      const isNumericCol = c === 7 || c === 8 || c === 9 || c === 10;
      const isCenteredCol = [0, 1, 2, 4, 11, 12, 13, 14, 15].includes(c);

      let cellFont: any = { name: 'Calibri', sz: 11, bold: false, color: { rgb: '000000' } };
      let cellFill: any = undefined;

      // Conditional Color: Column Nguồn Đơn (col 11)
      const currentSource = (val as string) || rowMetas[rowIdx]?.sourceText || '';
      if (c === 11) {
        if (currentSource === 'Trực tiếp') {
          cellFill = { fgColor: { rgb: 'D2DAE4' } };
        } else if (currentSource === 'Website') {
          cellFill = { fgColor: { rgb: 'FBD4B4' } };
        } else if (currentSource === 'MXH') {
          cellFill = { fgColor: { rgb: 'F2DBDB' } };
        }
      }

      // Conditional Color: Column Tình Trạng TT (col 12)
      const currentPaymentStatus = (val as string) || rowMetas[rowIdx]?.paymentStatusText || '';
      if (c === 12) {
        if (currentPaymentStatus === 'Đã thanh toán') {
          cellFill = { fgColor: { rgb: '748C42' } };
          cellFont = { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'C2D69B' } };
        } else if (currentPaymentStatus === 'Chưa thanh toán') {
          cellFill = { fgColor: { rgb: 'D99594' } };
          cellFont = { name: 'Calibri', sz: 11, bold: false, color: { rgb: '000000' } };
        }
      }

      cell.s = {
        fill: cellFill,
        font: cellFont,
        border: thinBorder,
        alignment: {
          vertical: 'center',
          horizontal: isNumericCol ? 'right' : isCenteredCol ? 'center' : 'left',
          wrapText: c === 5 || c === 6 || c === 16 // Wrap text on Address, Products, Notes
        }
      };

      // Ensure proper numeric type & formatting for Excel
      if (isNumericCol && typeof val === 'number') {
        cell.t = 'n';
        cell.z = '#,##0';
      }
    });
  });

  return worksheet;
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
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const exportTime = `${hh}h${mm}`;

  onProgress?.('Đang kết xuất bảng tính Excel...');

  const worksheet = buildStyledOrdersWorksheet(orders);
  const workbook = XLSX.utils.book_new();

  // Sheet Name: Danh Sách Đơn Hàng + (Export time)
  const sheetName = `Danh Sách Đơn Hàng (${exportTime})`.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // If user does NOT want images, download .xlsx directly
  if (!includeImages) {
    XLSX.writeFile(workbook, `NOT_A_KNOT_Don_Hang_${dateStr}_${exportTime}.xlsx`);
    return;
  }

  // If user requested images, package Excel + Images into a ZIP
  onProgress?.('Đang thu thập và nén hình ảnh bill & sản phẩm...');
  const zip = new JSZip();

  // 1. Add Excel file to ZIP
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  zip.file(`NOT_A_KNOT_Don_Hang_${dateStr}_${exportTime}.xlsx`, excelBuffer);

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
  link.download = `NOT_A_KNOT_Don_Hang_Kem_Anh_${dateStr}_${exportTime}.zip`;
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
    const wsOrders = buildStyledOrdersWorksheet(orders);
    XLSX.utils.book_append_sheet(workbook, wsOrders, '1. Đơn Hàng');
  }

  // Sheet 2: Products
  if (selectedTypes.products && products.length > 0) {
    const productRows = products.map((p, idx) => ({
      'STT': idx + 1,
      'Mã SP (ID)': safeCellText(p.id),
      'Tên Sản Phẩm': safeCellText(p.name),
      'Danh Mục': safeCellText(p.category),
      'Giá Bán (VNĐ)': typeof p.price === 'number' ? p.price : safeCellText(p.price),
      'Giá Gốc (VNĐ)': typeof p.originalPrice === 'number' ? p.originalPrice : (p.originalPrice ? safeCellText(p.originalPrice) : ''),
      'Tồn Kho': p.stock ?? 15,
      'Còn Hàng': p.inStock !== false ? 'Còn hàng' : 'Hết hàng',
      'Nhãn Giảm Giá': safeCellText(p.discountBadge || ''),
      'BST 02.09': p.isEvent0209 ? 'Có' : 'Không',
      'Best Seller': p.isBestSeller ? 'Có' : 'Không',
      'Sản Phẩm Mới': p.isNew ? 'Có' : 'Không',
      'Mô Tả': safeCellText(p.description || ''),
      'Thông Số Chi Tiết': safeCellText(Array.isArray(p.details) ? p.details.join(' | ') : (p as any).detailsText || ''),
      'Đường Dẫn Ảnh': safeCellText(p.image || '')
    }));
    const wsProducts = XLSX.utils.json_to_sheet(productRows);
    XLSX.utils.book_append_sheet(workbook, wsProducts, '2. Sản Phẩm & Kho');
  }

  // Sheet 3: Categories
  if (selectedTypes.categories && categories.length > 0) {
    const categoryRows = categories.map((c, idx) => ({
      'STT': idx + 1,
      'Mã Danh Mục (ID)': safeCellText(c.id),
      'Tên Danh Mục': safeCellText(c.label || (c as any).name || ''),
      'Màu Nổi Bật': safeCellText(c.highlightColor || ''),
      'Badge Nhãn': safeCellText(c.badge || ''),
      'Mô Tả': safeCellText(c.description || '')
    }));
    const wsCategories = XLSX.utils.json_to_sheet(categoryRows);
    XLSX.utils.book_append_sheet(workbook, wsCategories, '3. Danh Mục');
  }

  // Sheet 4: Collections & Banners
  if (selectedTypes.banners && collections.length > 0) {
    const collectionRows = collections.map((b, idx) => ({
      'STT': idx + 1,
      'Mã BST (ID)': safeCellText(b.id),
      'Tiêu Đề': safeCellText(b.title),
      'Tag Nhãn': safeCellText(b.tag || ''),
      'Điểm Nhấn': safeCellText(b.highlight || ''),
      'Mô Tả Phụ': safeCellText(b.subtitle || ''),
      'Là Đặt Trước (Pre-order)': b.isPreorder ? 'Có' : 'Không',
      'Thứ Tự Hiển Thị': b.order || idx + 1,
      'Ảnh Banner': safeCellText(b.bannerImage || b.bgImage || b.horizontalImage || '')
    }));
    const wsCollections = XLSX.utils.json_to_sheet(collectionRows);
    XLSX.utils.book_append_sheet(workbook, wsCollections, '4. Bộ Sưu Tập');
  }

  // Sheet 5: Site Configuration
  if (selectedTypes.siteContent && siteContent) {
    const siteRows = [
      { 'Thuộc Tính': 'Tên Thương Hiệu', 'Giá Trị': safeCellText(siteContent.brandName || '') },
      { 'Thuộc Tính': 'Slogan / Tagline', 'Giá Trị': safeCellText(siteContent.brandTagline || '') },
      { 'Thuộc Tính': 'Thông Báo Đầu Trang', 'Giá Trị': safeCellText(siteContent.announcementText || '') },
      { 'Thuộc Tính': 'Bật Thông Báo', 'Giá Trị': siteContent.announcementActive ? 'BẬT' : 'TẮT' },
      { 'Thuộc Tính': 'Số Điện Thoại Hotline', 'Giá Trị': safeCellText(siteContent.phone || '') },
      { 'Thuộc Tính': 'Zalo CSKH', 'Giá Trị': safeCellText(siteContent.zalo || '') },
      { 'Thuộc Tính': 'Địa Chỉ Xưởng', 'Giá Trị': safeCellText(siteContent.address || '') },
      { 'Thuộc Tính': 'Email Liên Hệ', 'Giá Trị': safeCellText(siteContent.email || '') },
      { 'Thuộc Tính': 'Facebook Link', 'Giá Trị': safeCellText(siteContent.socialLinks?.facebook || '') },
      { 'Thuộc Tính': 'Instagram Link', 'Giá Trị': safeCellText(siteContent.socialLinks?.instagram || '') },
      { 'Thuộc Tính': 'Threads Link', 'Giá Trị': safeCellText(siteContent.socialLinks?.threads || '') }
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
