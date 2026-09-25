import { SiteContentConfig } from '../types';

export const DEFAULT_SITE_CONTENT: SiteContentConfig = {
  brandName: 'NOT A KNOT',
  brandTagline: 'Xưởng Chế Tác Phụ Kiện Handmade Thủ Công',
  announcementText: '🇻🇳 Ưu đãi quà tặng: Tặng kèm móc khóa handmade cao cấp cho đơn từ 299k!',
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
      subtitle: 'Mỗi sản phẩm phụ kiện được thắt thủ công tỉ mỉ bằng tay với độ hoàn thiện cao nhất.',
      bgImage: '/assets/billboard-slide-1.webp',
      buttonText: 'Khám phá ngay',
      categoryLink: 'all',
      order: 1,
      isActive: true
    },
    {
      id: 'slide-2',
      tag: 'Everyday Collection',
      title: 'Phụ Kiện Handmade Thời Thượng',
      highlight: 'Chất Lượng Vượt Trội',
      subtitle: 'Dây đan cao cấp chịu lực tốt kết hợp khóa titan & inox 316L siêu bền không gỉ.',
      bgImage: '/assets/billboard-slide-2.webp',
      buttonText: 'Xem sản phẩm',
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
      q: 'Dây đan handmade có bị xù lông, phai màu hay ẩm mốc khi đi mưa hoặc tắm không?',
      a: 'Hoàn toàn không. 100% sản phẩm tại NOT A KNOT sử dụng sợi đan cao cấp tuyển chọn. Lớp vỏ bện kháng nước, nhanh ráo nước, không xù lông và giữ màu sắc nguyên bản theo thời gian.'
    },
    {
      id: 'faq-2',
      q: 'Chất lượng và độ hoàn thiện của sản phẩm ra sao?',
      a: 'Tất cả sản phẩm tại NOT A KNOT được đan tay thủ công tỉ mỉ từng chi tiết, sử dụng sợi bện cao cấp bền màu, khóa và charm tuyển chọn kỹ lưỡng, mang lại trải nghiệm êm ái và bền đẹp.'
    },
    {
      id: 'faq-3',
      q: 'Quy cách đóng gói và thời gian giao hàng như thế nào?',
      a: 'Mỗi sản phẩm đều được đóng gói cẩn thận trong hộp giấy cứng cáp. Thời gian giao hàng tại Hà Nội từ 1 đến 2 ngày làm việc, các tỉnh thành khác từ 2 đến 4 ngày làm việc. Khách hàng được kiểm tra hàng trước khi nhận.'
    },
    {
      id: 'faq-4',
      q: 'Chính sách bảo hành và đổi trả sản phẩm như thế nào?',
      a: 'Chúng tôi có chính sách bảo hành chi tiết đối với từng thành phần: khoen, charm, bùa, phụ kiện, hoặc dây khi gặp sự cố kỹ thuật trong quá trình sử dụng.'
    },
    {
      id: 'faq-5',
      q: 'Chính sách phí vận chuyển như thế nào?',
      a: 'Miễn phí giao hàng (0đ) cho tất cả đơn hàng trên toàn bộ Hà Nội. Phí vận chuyển đồng giá 20.000đ áp dụng cho các tỉnh thành khác trên toàn quốc.'
    }
  ],

  aboutSection: {
    badge: 'Về Chúng Tôi',
    title: 'Hành Trình Gắn Kết Những Nút Thắt Bản Lĩnh',
    subtitle: 'Xưởng chế tác phụ kiện handmade thủ công tại Hà Nội.',
    storyParagraph1: 'NOT A KNOT ra đời từ niềm đam mê chế tác thủ công bền bỉ. Tên gọi NOT A KNOT mang thông điệp: mỗi chiếc vòng tay không đơn thuần chỉ là những nút thắt vô tri, mà là sự gắn kết của tinh thần kiên cường, kỷ luật và phong cách cá nhân.',
    storyParagraph2: 'Chúng tôi tuyển chọn chất liệu đan thủ công cao cấp bền chắc, kết hợp cùng khóa titan và inox 316L đúc nguyên khối chống gỉ sét. Sản phẩm được đóng gói trang trọng trong hộp giấy.',
    quote: 'Một chiếc vòng bền bỉ không chỉ là phụ kiện làm đẹp, mà là người bạn đồng hành tin cậy trên mọi cung đường.',
    stats: [],
    coreValues: [
      {
        id: 'val-1',
        title: 'Đan Thủ Công Tỉ Mỉ',
        desc: 'Từng mắt đan được siết lực đều đặn, đảm bảo form dáng chắc nịch và sắc nét.',
        icon: 'Sparkles'
      },
      {
        id: 'val-2',
        title: 'Chất Liệu Đan Cao Cấp',
        desc: 'Chịu lực tốt, chống mài mòn, không xơ xước và không phai màu khi tiếp xúc với nước.',
        icon: 'ShieldCheck'
      },
      {
        id: 'val-3',
        title: 'Phụ Kiện Kim Loại Cao Cấp',
        desc: 'Khóa titan, inox 316L và hợp kim đúc chống oxy hóa gỉ sét bền bỉ với thời gian.',
        icon: 'Award'
      },
      {
        id: 'val-4',
        title: 'Bảo Hành Chi Tiết Từng Phụ Kiện',
        desc: 'Bảo hành rõ ràng cho khoen, charm, bùa, phụ kiện hoặc dây.',
        icon: 'HeartHandshake'
      }
    ],
    imageUrl: '/assets/bracelet.jpg'
  },

  customElements: [],

  footerDescription:
    'Not A Knot - Even More.\nNot A Knot cùng hệ thống website và các kênh truyền thông liên quan là dự án học tập và bài tập nhóm thuộc khuôn khổ môn Quản trị tác nghiệp Thương mại điện tử - Đại học Kinh tế Quốc dân. Dự án được triển khai hoàn toàn nhằm mục đích nghiên cứu, thực hành môn học và không mang tính chất kinh doanh thương mại.',
  copyrightText: '© 2026 NOT A KNOT. All rights reserved. Thủ công từ Việt Nam.',
  warrantyPolicy: 'Sản phẩm không có size. Có bảo hành chi tiết đối với khoen, charm, bùa, phụ kiện, hoặc dây. Đóng gói trong hộp giấy trang trọng.',
  shippingPolicy: 'Miễn phí giao hàng (0đ) trên toàn bộ Hà Nội. Phí vận chuyển đồng giá 20.000đ toàn quốc.',
  socialLinks: {
    facebook: 'https://www.facebook.com/profile.php?id=61593591390851',
    messenger: 'https://m.me/61593591390851',
    instagram: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
    threads: 'https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==',
    tiktok: '',
    zalo: ''
  },

  socialFeed: {
    title: 'GÓC TIN TỨC',
    subtitle: 'Theo dõi chúng tôi trên Facebook & Instagram để cập nhật các mẫu thiết kế mới, câu chuyện hậu trường và ưu đãi độc quyền.',
    badge: 'MẠNG XÃ HỘI & HOẠT ĐỘNG',
    isActive: true,
    posts: [
      {
        id: 'post-1',
        image: '/assets/about-story.jpg',
        caption: 'Hậu trường chế tác từng nút thắt thủ công tỉ mỉ cho bộ sưu tập độc bản Not A Knot.\n\nMỗi sản phẩm là một câu chuyện kết nối được tạo nên từ sự tận tâm của người thợ lành nghề.',
        url: 'https://www.facebook.com/profile.php?id=61593591390851',
        gradient: 'bg-white/85',
        borderColor: 'border-black'
      },
      {
        id: 'post-2',
        image: '/assets/img_4_NOT_A_KNOT.jpg',
        caption: 'BST Nàng Thơ 20/10 — Sự hòa quyện giữa charm hoa ngọt ngào và dây đan pastel dịu êm.\n\nThiết kế độc quyền tôn vinh vẻ đẹp tinh tế của phái đẹp.',
        url: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
        gradient: 'bg-white/85',
        borderColor: 'border-black'
      },
      {
        id: 'post-3',
        image: '/assets/hero-bg.png',
        caption: 'Phiên bản đặc biệt 02/09 — Năng lượng tự hào non sông trong từng nét đan thủ công.\n\nSợi chỉ đỏ kiên cường đan xen vẻ đẹp hiện đại.',
        url: 'https://www.facebook.com/profile.php?id=61593591390851',
        gradient: 'bg-white/85',
        borderColor: 'border-black'
      },
      {
        id: 'post-4',
        image: '/assets/img_0.jpg',
        caption: 'Gợi ý phối vòng charm phong cách tối giản cho outfit dạo phố cuối tuần thêm nổi bật.\n\nNhẹ nhàng, thanh lịch và cuốn hút trong từng khoảnh khắc.',
        url: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
        gradient: 'bg-white/85',
        borderColor: 'border-black'
      },
      {
        id: 'post-5',
        image: '/assets/image_4.jpg',
        caption: 'Dây đeo Everyday Wear êm ái, bền chắc trên cổ tay suốt ngày dài học tập và làm việc.\n\nĐồng hành cùng bạn trong mọi trải nghiệm cuộc sống.',
        url: 'https://www.facebook.com/profile.php?id=61593591390851',
        gradient: 'bg-white/85',
        borderColor: 'border-black'
      }
    ]
  }
};
