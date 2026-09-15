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
      isActive: true
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
      a: 'Hoàn toàn không. 100% sản phẩm tại NOT A KNOT sử dụng dây Paracord 550 chuẩn Type III với 7 lõi dù quân sự. Lớp vỏ bện ngoài kháng nước ngọt và nước mặn, nhanh ráo nước, không xù lông và giữ màu sắc nguyên bản theo thời gian.'
    },
    {
      id: 'faq-2',
      q: 'Kích cỡ sản phẩm như thế nào?',
      a: 'Sản phẩm của chúng tôi bán không có size. Thiết kế dạng freesize linh hoạt, dễ dàng điều chỉnh độ vừa vặn phù hợp cho mọi kích thước cổ tay.'
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
      a: 'Miễn phí giao hàng (0đ) cho tất cả đơn hàng tại quận Hai Bà Trưng, Hà Nội. Phí vận chuyển 5.000đ áp dụng cho các quận huyện còn lại tại Hà Nội. Phí vận chuyển đồng giá 20.000đ áp dụng cho các tỉnh thành khác trên toàn quốc.'
    }
  ],

  aboutSection: {
    badge: 'Về Chúng Tôi',
    title: 'Hành Trình Gắn Kết Những Nút Thắt Bản Lĩnh',
    subtitle: 'Xưởng chế tác phụ kiện dây dù Paracord 550 và EDC thủ công tại Hà Nội.',
    storyParagraph1: 'NOT A KNOT ra đời từ niềm đam mê chế tác thủ công bền bỉ. Tên gọi NOT A KNOT mang thông điệp: mỗi chiếc vòng tay không đơn thuần chỉ là những nút thắt vô tri, mà là sự gắn kết của tinh thần kiên cường, kỷ luật và phong cách cá nhân.',
    storyParagraph2: 'Chúng tôi tuyển chọn dây dù Paracord 550 chuẩn Type III với 7 lõi dù quân sự chịu tải 250kg, kết hợp cùng khóa titan và inox 316L đúc nguyên khối chống gỉ sét. Sản phẩm được đóng gói trang trọng trong hộp giấy.',
    quote: 'Một chiếc vòng bền bỉ không chỉ là phụ kiện làm đẹp, mà là người bạn đồng hành tin cậy trên mọi cung đường.',
    stats: [
      { label: 'Sản Phẩm Xuất Xưởng', value: '10.000+', desc: 'Đan thủ công tỉ mỉ' },
      { label: 'Chuẩn Paracord 550', value: '100%', desc: '7 lõi dù Type III bền bỉ' },
      { label: 'Bảo Hành Chi Tiết', value: 'Dài Hạn', desc: 'Khoen, charm, bùa, dây' },
      { label: 'Độ Hài Lòng', value: '100%', desc: 'Khách hàng toàn quốc' }
    ],
    coreValues: [
      {
        id: 'val-1',
        title: 'Đan Thủ Công Tỉ Mỉ',
        desc: 'Từng mắt đan được siết lực đều đặn, đảm bảo form dáng chắc nịch và sắc nét.',
        icon: 'Sparkles'
      },
      {
        id: 'val-2',
        title: 'Dây Paracord 550 Chuẩn 7 Lõi',
        desc: 'Chịu tải 250kg, chống mài mòn, không xơ xước và không phai màu khi tiếp xúc với nước.',
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

  footerDescription: 'Xưởng chế tác phụ kiện Paracord 550 và đồ EDC thủ công tại Hà Nội. Đóng gói hộp giấy trang trọng, bảo hành chi tiết khoen, charm, bùa, phụ kiện hoặc dây.',
  copyrightText: '© 2026 NOT A KNOT. All rights reserved. Thủ công từ Việt Nam.',
  warrantyPolicy: 'Sản phẩm không có size. Có bảo hành chi tiết đối với khoen, charm, bùa, phụ kiện, hoặc dây. Đóng gói trong hộp giấy trang trọng.',
  shippingPolicy: 'Miễn phí giao hàng (0đ) tại quận Hai Bà Trưng, Hà Nội. Phí vận chuyển 5.000đ cho các quận huyện Hà Nội khác. Phí vận chuyển đồng giá 20.000đ toàn quốc.',
  socialLinks: {
    facebook: 'https://www.facebook.com/profile.php?id=61593591390851',
    messenger: 'https://m.me/61593591390851',
    instagram: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
    threads: 'https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==',
    tiktok: 'https://www.tiktok.com/@notaknot.handmade',
    zalo: ''
  }
};
