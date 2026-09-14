import { SiteContentConfig } from '../types';

export const DEFAULT_SITE_CONTENT: SiteContentConfig = {
  brandName: 'NOT A KNOT',
  brandTagline: 'Xưởng Chế Tác Phụ Kiện Paracord & EDC Thủ Công',
  announcementText: '🇻🇳 Ưu đãi quà tặng: Tặng kèm móc khóa Paracord EDC cao cấp cho đơn từ 299k!',
  announcementLink: '#products',
  announcementActive: false,
  phone: '079 655 5636',
  zalo: '',
  address: 'Hanoi, Vietnam',
  email: 'notaknothandmade@gmail.com',
  bankAccount: {
    bankId: 'VCB',
    bankName: 'Vietcombank',
    accountNumber: '1028394859',
    accountHolder: 'VU NGOC MANH CUONG',
    branch: 'Sở Giao Dịch',
    qrTemplate: 'compact2'
  },
  
  heroSlides: [
    {
      id: 'slide-1',
      tag: 'Phiên Bản Giới Hạn 2026',
      title: 'Đan Dệt Bản Lĩnh & Phong Cách',
      highlight: 'Sự Kết Hợp Độc Bản',
      subtitle: 'Mỗi mắt đan Paracord 550 được thắt thủ công tỉ mỉ bằng tay với độ hoàn thiện cao nhất.',
      bgImage: '/assets/bracelet.jpg',
      buttonText: 'Khám phá ngay',
      categoryLink: 'all',
      order: 1,
      isActive: true,
      aspectRatioMobile: '1:1',
      bgFitMobile: 'cover'
    },
    {
      id: 'slide-2',
      tag: 'Everyday Carry Collection',
      title: 'Phụ Kiện EDC Chuẩn Sinh Tồn',
      highlight: 'Chất Lượng Vượt Trội',
      subtitle: 'Dây dù chuẩn Type III chịu tải 250kg kết hợp khóa titan & inox 316L siêu bền không gỉ.',
      bgImage: '/assets/img_3.jpg',
      buttonText: 'Xem sản phẩm EDC',
      categoryLink: 'keychains',
      order: 2,
      isActive: true
    }
  ],

  landingProducts: {
    id: 'section-the-collection',
    title: 'THE COLLECTION',
    subtitle: '',
    badgeText: 'NEW',
    viewAllText: 'Xem tất cả',
    detailButtonText: 'Chi tiết',
    isActive: true,
    displayLimit: 8,
    filterCategory: 'all',
    selectedProductIds: [],
    gridColumns: 4
  },

  landingProductSections: [
    {
      id: 'section-the-collection',
      title: 'THE COLLECTION',
      subtitle: '',
      badgeText: 'NEW',
      viewAllText: 'Xem tất cả',
      detailButtonText: 'Chi tiết',
      isActive: true,
      displayLimit: 8,
      filterCategory: 'all',
      selectedProductIds: [],
      gridColumns: 4
    }
  ],

  faqTitle: 'Câu Hỏi Thường Gặp',
  faqSubtitle: '',
  faqs: [
    {
      id: 'faq-1',
      q: 'Dây Paracord có bị xù lông, phai màu hay ẩm mốc khi đi mưa hoặc tắm không?',
      a: 'Hoàn toàn không. 100% sản phẩm tại NOT A KNOT sử dụng dây Paracord 550 chuẩn Type III với 7 lõi dù quân sự. Lớp vỏ bện ngoài kháng nước ngọt/mặn, nhanh ráo nước, không xù lông và giữ màu sắc nguyên bản theo thời gian.'
    },
    {
      id: 'faq-2',
      q: 'Kích cỡ và kiểu dáng sản phẩm như thế nào?',
      a: 'Tất cả sản phẩm đều được thiết kế và chế tác hoàn chỉnh theo chuẩn form dáng cố định tối ưu nhất, ôm tay thoải mái và dễ đeo cho hầu hết người dùng. Bạn chỉ cần chọn mẫu ưng ý và đặt hàng trực tiếp.'
    },
    {
      id: 'faq-3',
      q: 'Thời gian hoàn thiện và giao hàng là bao lâu?',
      a: 'Mỗi sản phẩm đều sẵn sàng xuất xưởng nhanh chóng từ 1 - 2 ngày làm việc. Thời gian giao hàng toàn quốc từ 2 - 4 ngày. Bạn được quyền kiểm tra hàng trước khi thanh toán.'
    },
    {
      id: 'faq-4',
      q: 'Chính sách bảo hành nút đan và đổi trả sản phẩm như thế nào?',
      a: 'NOT A KNOT áp dụng chính sách Bảo hành nút thắt trọn đời: hỗ trợ vệ sinh và làm mới miễn phí. Nếu nhận hàng có lỗi kỹ thuật từ nhà sản xuất, bạn được hỗ trợ đổi mới miễn phí trong 7 ngày đầu tiên.'
    }
  ],

  aboutSection: {
    badge: 'Về Chúng Tôi · NOT A KNOT',
    title: 'Hành Trình Gắn Kết Những Nút Thắt Bản Lĩnh',
    subtitle: 'Xưởng chế tác phụ kiện dây dù Paracord 550 & EDC thủ công tại NEU - Hà Nội.',
    storyParagraph1: 'NOT A KNOT ra đời từ niềm đam mê chế tác thủ công bền bỉ. Tên gọi NOT A KNOT mang thông điệp: mỗi chiếc vòng tay không đơn thuần chỉ là những nút thắt vô tri, mà là sự gắn kết của tinh thần kiên cường, kỷ luật và phong cách cá nhân.',
    storyParagraph2: 'Chúng tôi tuyển chọn 100% dây dù Paracord 550 chuẩn Type III với 7 lõi dù quân sự chịu tải 250kg, kết hợp cùng khóa titan và inox 316L đúc nguyên khối chống gỉ sét tuyệt đối. Mỗi sản phẩm đều được nghệ nhân đan thủ công tỉ mỉ theo form dáng chuẩn tối ưu nhất.',
    quote: '“Một chiếc vòng bền bỉ không chỉ là phụ kiện làm đẹp, mà là người bạn đồng hành tin cậy trên mọi cung đường.”',
    stats: [
      { label: 'Sản Phẩm Xuất Xưởng', value: '10.000+', desc: 'Đan thủ công tỉ mỉ' },
      { label: 'Chuẩn Paracord 550', value: '100%', desc: '7 lõi dù Type III bền bỉ' },
      { label: 'Bảo Hành Nút Thắt', value: 'Trọn Đời', desc: 'Vệ sinh & đan lại miễn phí' },
      { label: 'Độ Hài Lòng', value: '100%', desc: 'Khách hàng toàn quốc' }
    ],
    coreValues: [
      {
        id: 'val-1',
        title: '100% Đan Thủ Công Tỉ Mỉ',
        desc: 'Từng mắt đan được nghệ nhân siết lực đều đặn, đảm bảo form dáng đan chắc nịch và sắc nét.',
        icon: 'Sparkles'
      },
      {
        id: 'val-2',
        title: 'Dây Paracord 550 Chuẩn 7 Lõi',
        desc: 'Chịu tải 250kg, chống mài mòn, không xơ xước và không phai màu khi tiếp xúc với nước sinh hoạt hay đi mưa.',
        icon: 'ShieldCheck'
      },
      {
        id: 'val-3',
        title: 'Phụ Kiện Kim Loại Cao Cấp',
        desc: 'Khóa titan, inox 316L và hợp kim đúc chống oxy hóa gỉ sét, mạ điện phân bền bỉ với thời gian.',
        icon: 'Award'
      },
      {
        id: 'val-4',
        title: 'Bảo Hành Nút Thắt Trọn Đời',
        desc: 'Hỗ trợ vệ sinh, làm mới và thắt lại nút dây miễn phí trọn đời cho toàn bộ sản phẩm xuất xưởng.',
        icon: 'HeartHandshake'
      }
    ],
    imageUrl: '/assets/bracelet.jpg'
  },

  customElements: [],

  footerDescription: 'Xưởng chế tác phụ kiện Paracord 550 và đồ EDC thủ công tại NEU - Hà Nội. Thiết kế độc bản, đan thủ công tỉ mỉ, bảo hành nút thắt trọn đời.',
  copyrightText: '© 2026 NOT A KNOT. All rights reserved. Thủ công từ Việt Nam.',
  warrantyPolicy: 'Bảo hành nút thắt trọn đời: hỗ trợ đan lại dây, vệ sinh làm mới miễn phí. Đổi mới phụ kiện kim loại bị lỗi kỹ thuật trong 30 ngày.',
  shippingPolicy: 'Giao hàng toàn quốc từ 2-4 ngày. Hỗ trợ kiểm tra hàng trước khi thanh toán (COD). Miễn phí vận chuyển cho đơn hàng từ 400.000đ.',
  socialLinks: {
    facebook: 'https://www.facebook.com/profile.php?id=61593591390851',
    messenger: 'https://m.me/61593591390851',
    instagram: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
    threads: 'https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==',
    tiktok: 'https://www.tiktok.com/@notaknot.handmade',
    zalo: ''
  }
};
