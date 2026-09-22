import { Product, BannerItem } from '../types';

export const HERO_BANNERS: BannerItem[] = [
  {
    id: 'banner-0209',
    tag: 'PHIÊN BẢN ĐẶC BIỆT 02.09',
    title: 'Hào Khí Non Sông',
    highlight: 'Tự Hào Việt Nam',
    subtitle: 'Kỷ vật phụ kiện thủ công phiên bản giới hạn kỷ niệm ngày Quốc khánh.',
    bgImage: '/assets/hero-bg.png',
    bgGradient: 'from-black/90 via-black/60 to-transparent',
    categoryLink: 'event_0209',
    buttonText: 'Đặt trước ngay',
    isEvent0209: true,
    themeColor: '#B41C1A'
  },
  {
    id: 'banner-2010',
    tag: 'BỘ SƯU TẬP 20/10 — QUÀ TẶNG NÀNG',
    title: 'Nàng Thơ Dịu Dàng',
    highlight: 'Tôn Vinh Phụ Nữ VN',
    subtitle: 'Sự hòa quyện giữa nét mềm mại của Charm hoa, tone Pastel và nét đẹp thủ công tinh tế.',
    bgImage: '/assets/img_4_NOT_A_KNOT.jpg',
    bgGradient: 'from-rose-950/90 via-pink-950/65 to-transparent',
    categoryLink: 'event_2010',
    buttonText: 'Khám phá BST 20.10',
    isEvent0209: false,
    themeColor: '#E11D48'
  },
  {
    id: 'banner-charm',
    tag: 'CHARM BRACELET COLLECTION',
    title: 'Vòng Charm Phong Cách',
    highlight: 'Biểu Tượng Tinh Xảo',
    subtitle: 'Hạt charm phong thủy, cung hoàng đạo và chữ cái theo mẫu thiết kế hoàn thiện.',
    bgImage: '/assets/img_0.jpg',
    bgGradient: 'from-stone-950/90 via-neutral-900/65 to-transparent',
    categoryLink: 'charm_bracelet',
    buttonText: 'Xem BST Vòng Charm',
    isEvent0209: false,
    themeColor: '#78350F'
  },
  {
    id: 'banner-everyday',
    tag: 'EVERYDAY WEAR COLLECTION',
    title: 'Phong Cách Hằng Ngày',
    highlight: 'Tối Giản & Tinh Tế',
    subtitle: 'Bản đan mảnh nhẹ, êm ái khi đeo làm việc, dễ dàng phối hợp với mọi trang phục.',
    bgImage: '/assets/image_4.jpg',
    bgGradient: 'from-stone-950/90 via-stone-900/65 to-transparent',
    categoryLink: 'everyday',
    buttonText: 'Xem Everyday Wear',
    isEvent0209: false,
    themeColor: '#475569'
  }
];

export const PRODUCTS: Product[] = [
  {
    "rating": 5,
    "image": "/assets/0209/img_3.jpg",
    "isEvent2010": false,
    "category": "event_0209",
    "discountBadge": "Giảm giá",
    "isNew": false,
    "updatedAt": "2026-09-03T07:55:11.100Z",
    "originalPrice": 50000,
    "description": "Được tết thủ công tỉ mỉ từ dây đan siêu bền, điểm nhấn là phù hiệu lá cờ đỏ sao vàng thêu nổi ngay giữa vòng. Một kỷ vật mang tinh thần kiên cường, dành tặng cho những người tự hào là người Việt.",
    "images": [
      "/assets/0209/img_3.jpg"
    ],
    "name": "Vòng Tay 02/09 Edition",
    "details": [
      "Chất liệu: Dây đan thủ công cao cấp",
      "Màu sắc: Dây xanh, gắn cờ đỏ sao vàng rực rỡ tượng trưng Quốc kỳ",
      "Độ bền: Chống nước, chống tia UV, không sờn rách"
    ],
    "inStock": true,
    "stock": 50,
    "isBestSeller": false,
    "price": 39000,
    "isEvent0209": false,
    "id": "nak-0209-bracelet"
  },
  {
    "discountBadge": "Giảm giá",
    "isBestSeller": false,
    "description": "Hình tượng chú bộ đội nhí nhảnh, đáng yêu — biểu tượng của thế hệ anh hùng đã viết nên lịch sử. Móc khoá acrylic đa lớp, sắc nét, bền đẹp theo thời gian.",
    "isNew": false,
    "stock": 0,
    "originalPrice": 40000,
    "image": "/assets/keychain-bodoi.jpg",
    "isEvent2010": false,
    "images": [
      "/assets/keychain-bodoi.jpg"
    ],
    "id": "nak-prod-1787939174867",
    "category": "event_0209",
    "price": 29000,
    "inStock": false,
    "updatedAt": "2026-09-03T07:55:11.454Z",
    "isEvent0209": false,
    "details": [
      "Dây đan thủ công cao cấp",
      "Khóa kim loại titan chống rỉ sét"
    ],
    "name": "Móc khoá 02/09 — Chú bộ đội"
  },
  {
    "updatedAt": "2026-09-03T07:55:12.081Z",
    "isEvent0209": false,
    "details": [
      "Dây đan thủ công cao cấp",
      "Khóa kim loại titan chống rỉ sét"
    ],
    "name": "Móc khoá 02/09 — Mũ cối",
    "inStock": false,
    "price": 35000,
    "image": "/assets/keychain-mucoi.jpg",
    "category": "event_0209",
    "description": "Chiếc mũ cối kháng chiến huyền thoại — người bạn đồng hành của bao thế hệ chiến sĩ. Nay được tái hiện tinh tế dưới dạng móc khoá, mang theo cả một thời hào hùng bên cạnh bạn.",
    "discountBadge": "Giảm giá",
    "isBestSeller": false,
    "images": [
      "/assets/keychain-mucoi.jpg"
    ],
    "originalPrice": 40000,
    "isEvent2010": false,
    "id": "nak-prod-1788103862340",
    "isNew": false,
    "stock": 0
  }
];

export const BRAND_VALUES = [
  {
    icon: 'ShieldCheck',
    title: 'Chất Liệu Cao Cấp',
    description: 'Sợi đan bền bỉ, chống nước, chống tia UV và không sờn rách theo năm tháng.'
  },
  {
    icon: 'Hammer',
    title: 'Thủ Công 100%',
    description: 'Từng nút thắt được các nghệ nhân đan tay tỉ mỉ, căn chỉnh độ căng hoàn hảo tạo form dáng cứng cáp.'
  },
  {
    icon: 'Sparkles',
    title: 'Thiết Kế Độc Bản',
    description: 'Phối màu tinh tế mang đậm tinh thần nghệ thuật, phụ kiện thời thượng và cá tính.'
  },
  {
    icon: 'RefreshCw',
    title: 'Bảo Hành Bền Lâu',
    description: 'Cam kết chất lượng chỉn chu, bảo hành dây và khóa, hỗ trợ làm sạch và tết lại theo yêu cầu.'
  }
];

export const KNOT_TYPES = [
  {
    badge: 'Kinh điển',
    name: 'Cobra Weave',
    desc: 'Mũi đan rắn hổ mang dày dặn, chịu lực tối đa, là biểu tượng của sự kiên cường và phong cách EDC mạnh mẽ.'
  },
  {
    badge: 'Tinh xảo',
    name: 'Fishtail Knot',
    desc: 'Đan xương cá thon gọn, thanh lịch, phù hợp phối cùng đồng hồ hoặc trang sức hằng ngày.'
  },
  {
    badge: 'Bền bỉ',
    name: 'King Cobra',
    desc: 'Bản đan đôi dày dặn gấp đôi lượng dây, tạo cảm giác đầm tay và chắc chắn vượt trội.'
  },
  {
    badge: 'Độc đáo',
    name: 'Snake Knot',
    desc: 'Nút thắt tròn linh hoạt, chuyên dùng cho móc khóa và dây đeo phụ kiện chống rối hiệu quả.'
  }
];
