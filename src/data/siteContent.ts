import { SiteContentConfig } from '../types';

export const DEFAULT_SITE_CONTENT: SiteContentConfig = {
  brandName: 'NOT A KNOT',
  brandTagline: 'Xưởng Chế Tác Phụ Kiện Paracord & EDC Thủ Công',
  announcementText: '🇻🇳 Sự Kiện 02/09: Nhận đặt trước BST Hào Khí Độc Lập - Giảm 15% khi thanh toán chuyển khoản',
  announcementLink: '#collection?id=event_0209',
  announcementActive: true,
  phone: '0987.654.321',
  zalo: '0987.654.321',
  address: 'NEU - Hà Nội',
  email: 'contact@notaknot.vn',
  
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
      tag: 'Kỷ Niệm Quốc Khánh 02.09',
      title: 'Hào Khí 02.09 — Bản Hùng Ca',
      highlight: 'Tết Độc Lập',
      subtitle: 'BST Phụ kiện mang sắc đỏ son & vàng kim, tôn vinh tinh thần kiên cường và niềm tự hào dân tộc.',
      bgImage: '/assets/img_1.jpg',
      buttonText: 'Xem BST 02/09',
      categoryLink: 'event_0209',
      order: 2,
      isActive: true
    },
    {
      id: 'slide-3',
      tag: 'Everyday Carry Collection',
      title: 'Phụ Kiện EDC Chuẩn Sinh Tồn',
      highlight: 'Chất Lượng Vượt Trội',
      subtitle: 'Dây dù chuẩn Type III chịu tải 250kg kết hợp khóa titan & inox 316L siêu bền không gỉ.',
      bgImage: '/assets/img_3.jpg',
      buttonText: 'Xem sản phẩm EDC',
      categoryLink: 'keychains',
      order: 3,
      isActive: true
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
      { label: 'Đánh Giá Hài Lòng', value: '4.9/5★', desc: 'Khách hàng toàn quốc' }
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
    instagram: 'https://www.instagram.com/notaknot.handmade?igsi=MWszYjN4MmczMjNzMQ==',
    threads: 'https://www.threads.com/@notaknot.handmade?igshid=NTc4MTIwNjQ2YQ==',
    tiktok: 'https://www.tiktok.com/@notaknot.handmade',
    zalo: '0987.654.321'
  }
};
