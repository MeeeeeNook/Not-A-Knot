import { Product, BannerItem } from '../types';

export const HERO_BANNERS: BannerItem[] = [
  {
    id: 'banner-0209',
    tag: 'PHIÊN BẢN ĐẶC BIỆT 02.09',
    title: 'Hào Khí Non Sông',
    highlight: 'Tự Hào Việt Nam',
    subtitle: 'Kỷ vật phụ kiện Paracord thủ công phiên bản giới hạn kỷ niệm ngày Quốc khánh.',
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
    subtitle: 'Sự hòa quyện giữa nét mềm mại của Charm hoa, tone Pastel và độ bền tinh tế của Paracord.',
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
    bgGradient: 'from-purple-950/90 via-neutral-900/65 to-transparent',
    categoryLink: 'charm_bracelet',
    buttonText: 'Xem BST Vòng Charm',
    isEvent0209: false,
    themeColor: '#9333EA'
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
  // ==========================================
  // 1. BST QUỐC KHÁNH 02.09 (EVENT 02/09)
  // ==========================================
  {
    id: 'nak-0209-bracelet',
    name: 'Vòng Paracord 02/09 Edition',
    category: 'event_0209',
    price: 39000,
    originalPrice: 55000,
    discountBadge: '-29%',
    image: '/assets/0209/img_3.jpg',
    images: ['/assets/0209/img_3.jpg', '/assets/bracelet.jpg', '/assets/img_1_Vng_tay_P.jpg'],
    description: 'Vòng tay handmade bện từ dây Paracord 550 cao cấp với 2 màu Đỏ - Vàng rực rỡ, lấy cảm hứng từ Quốc kỳ Việt Nam. Bền bỉ, chống nước, tượng trưng cho tinh thần kiên cường bất khuất.',
    details: [
      'Chất liệu: Dây Paracord 550 Type III lõi 7 sợi chịu tải 250kg',
      'Màu sắc: Đỏ Cờ - Vàng Sao rực rỡ tượng trưng Quốc kỳ',
      'Khóa chốt: Khóa bấm hợp kim chống rỉ sét mạ tĩnh điện',
      'Độ bền: Chống nước, chống tia UV, không sờn rách',
      'Tặng kèm hộp quà NOT A KNOT phiên bản 02/09'
    ],
    isEvent0209: true,
    isBestSeller: true,
    rating: 5.0,
    reviewsCount: 168,
    stock: 35,
    inStock: true
  },
  {
    id: 'nak-0209-keychain-bodoi',
    name: 'Móc khoá 02/09 — Chú bộ đội',
    category: 'event_0209',
    price: 29000,
    originalPrice: 40000,
    discountBadge: '-27%',
    image: '/assets/0209/img_4.jpg',
    images: ['/assets/0209/img_4.jpg', '/assets/keychain-bodoi.jpg'],
    description: 'Hình tượng chú bộ đội nhí nhảnh, đáng yêu — biểu tượng của thế hệ anh hùng đã viết nên lịch sử. Móc khoá acrylic đa lớp, sắc nét, bền đẹp theo thời gian.',
    details: [
      'Chất liệu: Acrylic phủ epoxy bóng 2 mặt chống trầy xước',
      'Khuyên móc: Thép không gỉ mạ nickel sáng bóng cao cấp',
      'Điểm nhấn: Nút thắt Paracord xanh quân phục thủ công',
      'Kích thước: 5.5cm x 4.2cm',
      'Thích hợp gắn chìa khóa, balo, túi xách'
    ],
    isEvent0209: true,
    isBestSeller: true,
    rating: 5.0,
    reviewsCount: 112,
    stock: 45,
    inStock: true
  },
  {
    id: 'nak-0209-keychain-mucoi',
    name: 'Móc khoá 02/09 — Mũ cối',
    category: 'event_0209',
    price: 35000,
    originalPrice: 40000,
    discountBadge: '-27%',
    image: '/assets/0209/img_5.jpg',
    images: ['/assets/0209/img_5.jpg', '/assets/keychain-mucoi.jpg'],
    description: 'Chiếc mũ cối kháng chiến huyền thoại — người bạn đồng hành của bao thế hệ chiến sĩ. Nay được tái hiện tinh tế dưới dạng móc khoá, mang theo cả một thời hào hùng bên cạnh bạn.',
    details: [
      'Chất liệu: Acrylic đúc khối 3D chi tiết',
      'Nút thắt: Dây Paracord thắt kiểu Snake Knot trợ lực',
      'Khóa cài: Khóa càng cua xoay 360 độ tiện lợi',
      'Độ dày: 4mm chống va đập, không ố màu'
    ],
    isEvent0209: true,
    isNew: true,
    rating: 4.9,
    reviewsCount: 88,
    stock: 30,
    inStock: true
  },
  {
    id: 'nak-0209-combo-tron-bo',
    name: 'Combo Trọn Bộ 02/09 (1 Vòng + 2 Móc Khóa + Hộp Quà)',
    category: 'event_0209',
    price: 89000,
    originalPrice: 135000,
    discountBadge: 'Tiết kiệm 34%',
    image: '/assets/0209/img_1.png',
    images: ['/assets/0209/img_1.png', '/assets/0209/img_3.jpg', '/assets/0209/img_4.jpg', '/assets/0209/img_5.jpg'],
    description: 'Trọn bộ sưu tập kỷ niệm Quốc Khánh bao gồm 01 Vòng Paracord 02/09 Edition, 01 Móc khoá Chú bộ đội, 01 Móc khoá Mũ cối, tặng kèm Hộp quà NOT A KNOT cao cấp.',
    details: [
      '01 Vòng Paracord 02/09 Edition (Tùy chọn size)',
      '01 Móc khoá 02/09 Chú bộ đội',
      '01 Móc khoá 02/09 Mũ cối kháng chiến',
      '01 Hộp quà cao cấp & Thiệp viết tay kỷ niệm 02/09',
      'Freeship khi đặt trước hôm nay'
    ],
    isEvent0209: true,
    isBestSeller: true,
    rating: 5.0,
    reviewsCount: 204,
    stock: 25,
    inStock: true
  },
  {
    id: 'nak-0209-king-cobra-flag',
    name: 'Vòng Paracord Cờ Đỏ Sao Vàng — King Cobra Bản Dày',
    category: 'event_0209',
    price: 55000,
    originalPrice: 75000,
    discountBadge: '-26%',
    image: '/assets/img_1_Vng_tay_P.jpg',
    images: ['/assets/img_1_Vng_tay_P.jpg', '/assets/bracelet.jpg'],
    description: 'Bản đan King Cobra 2.4cm uy lực dệt phối màu Cờ Đỏ Sao Vàng rực rỡ, thích hợp cho sự kiện duyệt binh, phượt xuyên Việt và lễ hội Quốc Khánh.',
    details: [
      'Kiểu đan: King Cobra Weave dệt kép 2 lớp siêu chắc',
      'Phù hiệu: Ngôi Sao Vàng kim loại đúc nổi ở giữa vòng',
      'Khóa: Khóa móng ngựa Shackle thép không gỉ mạ đen',
      'Độ bền: Chịu lực kéo hơn 300kg, chống mài mòn cao'
    ],
    isEvent0209: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 65,
    stock: 22,
    inStock: true
  },
  {
    id: 'nak-0209-tricolor-heritage',
    name: 'Vòng Paracord Kỷ Vật 02/09 Độc Bản — Tam Sắc Độc Lập',
    category: 'event_0209',
    price: 65000,
    originalPrice: 85000,
    discountBadge: 'Phiên Bản Giới Hạn',
    image: '/assets/bracelet.jpg',
    images: ['/assets/bracelet.jpg', '/assets/img_1_Vng_tay_P.jpg'],
    description: 'Bản đan ba sợi liên hoàn tôn vinh 3 mảng màu: Đỏ Hào Khí, Vàng Sao Dân Tộc và Xanh Rêu Quân Đội. Đính huy hiệu kim loại đúc nổi biểu tượng cột mốc biên cương.',
    details: [
      'Chất liệu: Paracord 550 7 lõi dệt 3 màu đồng tâm',
      'Huy hiệu: Hợp kim đúc dập nổi mạ vàng Gold mờ',
      'Khóa cài: Khóa bấm kim loại Shackle sơn tĩnh điện',
      'Tặng kèm hộp quà NOT A KNOT 02.09 có thiệp chứng nhận số series'
    ],
    isEvent0209: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 41,
    stock: 15,
    inStock: true
  },
  {
    id: 'nak-0209-keychain-saovang',
    name: 'Móc Khóa Paracord Sao Vàng Yêu Nước 02.09',
    category: 'event_0209',
    price: 32000,
    originalPrice: 45000,
    discountBadge: 'Phụ Kiện Balo 02/09',
    image: '/assets/img_2_Mc_kho_C.jpg',
    images: ['/assets/img_2_Mc_kho_C.jpg', '/assets/keychain-bodoi.jpg'],
    description: 'Móc khóa EDC đan nút Diamond Knot đỏ tươi với charm Ngôi Sao Vàng mạ titan bóng bẩy, món phụ kiện nhỏ gọn đầy nhiệt huyết.',
    details: [
      'Nút thắt: Diamond Knot kết hợp Snake Knot bện chặt',
      'Khuyên tròn dẹp chống bung chìa mạ Titan',
      'Dễ dàng móc đỉa quần, balo, quai túi'
    ],
    isEvent0209: true,
    rating: 4.8,
    reviewsCount: 52,
    stock: 30,
    inStock: true
  },

  // ==========================================
  // 2. BST 20/10 — QUÀ TẶNG NÀNG THƠ (EVENT 20/10)
  // ==========================================
  {
    id: 'nak-2010-rose-gold-charm',
    name: 'BST 20/10 — Vòng Paracord Nàng Thơ & Charm Hoa Hồng',
    category: 'event_2010',
    price: 69000,
    originalPrice: 89000,
    discountBadge: 'BST 20/10 Hot',
    image: '/assets/img_4_NOT_A_KNOT.jpg',
    images: ['/assets/img_4_NOT_A_KNOT.jpg', '/assets/image_4.jpg', '/assets/bracelet.jpg'],
    description: 'Thiết kế dịu dàng dành tặng phái đẹp nhân dịp 20/10. Dây Paracord đan vân Fishtail mảnh mai kết hợp hạt Charm hoa hồng mạ Rose Gold sáng bóng.',
    details: [
      'Chất liệu: Paracord 550 bản mỏng 1.2cm siêu êm tay',
      'Hạt Charm: Charm hoa hồng & trái tim mạ Rose Gold chống xỉn màu',
      'Khóa chốt: Khóa rút tiện lợi, phom dáng cố định chuẩn nữ',
      'Tặng kèm hộp quà hồng Pastel + Thiệp chúc mừng 20/10 xinh xắn'
    ],
    isEvent2010: true,
    isBestSeller: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 156,
    stock: 40,
    inStock: true
  },
  {
    id: 'nak-2010-giftset-tulip',
    name: 'BST 20/10 — Combo Hộp Quà Vòng Charm & Hoa Sáp Cao Cấp',
    category: 'event_2010',
    price: 139000,
    originalPrice: 180000,
    discountBadge: 'Set Quà Tặng 20/10',
    image: '/assets/image_4.jpg',
    images: ['/assets/image_4.jpg', '/assets/img_4_NOT_A_KNOT.jpg'],
    description: 'Set quà trọn gói ý nghĩa gồm 1 vòng tay Paracord charm, hoa sáp thơm vĩnh cửu, hộp đựng quà sang trọng và thiệp mừng trang nhã.',
    details: [
      'Bao gồm: 01 Vòng Paracord Charm + 03 Bông Hoa Sáp Thơm',
      'Hộp quà nắp kính thắt nơ lụa cao cấp',
      'Kèm thiệp chúc mừng gửi tặng người thương, mẹ, cô giáo',
      'Bảo hành làm mới và đan lại trọn đời'
    ],
    isEvent2010: true,
    isBestSeller: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 92,
    stock: 18,
    inStock: true
  },
  {
    id: 'nak-2010-heart-charm-slim',
    name: 'BST 20/10 — Vòng Paracord Trái Tim Rose Gold Đính Đá',
    category: 'event_2010',
    price: 75000,
    originalPrice: 95000,
    discountBadge: 'Mẫu Nữ Tính',
    image: '/assets/image_1.jpg',
    images: ['/assets/image_1.jpg', '/assets/img_4_NOT_A_KNOT.jpg'],
    description: 'Bản đan Fishtail thanh mảnh điểm hạt charm trái tim đính đá pha lê lấp lánh. Món quà hoàn hảo để bày tỏ tình cảm chân thành.',
    details: [
      'Charm: Trái tim Titan mạ vàng hồng đính đá Cubic Zirconia',
      'Dây đan: Paracord Type I siêu mảnh 0.9cm êm ái',
      'Chống nước, không kích ứng da tay nhạy cảm',
      'Hộp quà cao cấp đi kèm nơ lụa'
    ],
    isEvent2010: true,
    isNew: true,
    rating: 4.9,
    reviewsCount: 68,
    stock: 25,
    inStock: true
  },
  {
    id: 'nak-2010-lavender-slim',
    name: 'BST 20/10 — Vòng Tay Paracord Lavender Slim Dịu Dàng',
    category: 'event_2010',
    price: 59000,
    originalPrice: 79000,
    discountBadge: 'Tone Pastel Hot',
    image: '/assets/img_0.jpg',
    images: ['/assets/img_0.jpg', '/assets/image_4.jpg'],
    description: 'Tone màu tím oải hương Lavender mộng mơ kết hợp khóa tròn nam châm hút tiện dụng, mang lại cảm giác thư thái và duyên dáng.',
    details: [
      'Khóa: Nam châm Neodymium lực hút mạnh dễ dàng tự đeo bằng một tay',
      'Bản đan: Vân xoắn Snake Knot tròn mềm mại',
      'Trọng lượng siêu nhẹ chỉ 10g'
    ],
    isEvent2010: true,
    rating: 4.9,
    reviewsCount: 47,
    stock: 30,
    inStock: true
  },
  {
    id: 'nak-2010-sakura-blossom',
    name: 'BST 20/10 — Vòng Paracord Sakura Blossom & Charm Hoa Anh Đào',
    category: 'event_2010',
    price: 85000,
    originalPrice: 110000,
    discountBadge: 'Phiên Bản Hoa Sakura',
    image: '/assets/img_4_NOT_A_KNOT.jpg',
    images: ['/assets/img_4_NOT_A_KNOT.jpg', '/assets/image_4.jpg'],
    description: 'Tone hồng Sakura phớt trắng kết hợp hạt charm 5 cánh hoa anh đào đính đá xà cừ phát quang nhẹ. Phong cách thanh tao, nhẹ nhàng cho nàng thơ.',
    details: [
      'Chất liệu: Dây Paracord Micro bện vân ngọc trai mềm mượt',
      'Charm hoa: Hợp kim đúc phủ men xà cừ chống ố nước',
      'Khóa chốt: Khóa rút giọt nước điều chỉnh nhẹ nhàng',
      'Tặng kèm hộp quà nắp kính & túi xách cao cấp'
    ],
    isEvent2010: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 53,
    stock: 22,
    inStock: true
  },

  // ==========================================
  // 3. VÒNG CHARM PHONG CÁCH (CHARM BRACELET)
  // ==========================================
  {
    id: 'nak-charm-astrolabe-titanium',
    name: 'Vòng Charm Paracord Thước Thiên Văn & 12 Chòm Sao Cổ Điển',
    category: 'charm_bracelet',
    price: 95000,
    originalPrice: 125000,
    discountBadge: 'Thiên Văn Học',
    image: '/assets/img_0.jpg',
    images: ['/assets/img_0.jpg', '/assets/image_1.jpg'],
    description: 'Charm vòng xoay thiên văn Astrolabe bằng titan xước cổ điển, tượng trưng cho hành trình khám phá vũ trụ và tự do vô tận.',
    details: [
      'Charm Thiên Văn có vòng xoay cơ học 360 độ độc đáo',
      'Bện Paracord kép 2 tầng dập nổi vân đá',
      'Chống ăn mòn muối biển, bền bỉ qua năm tháng'
    ],
    isNew: true,
    rating: 5.0,
    reviewsCount: 78,
    stock: 20,
    inStock: true
  },
  {
    id: 'nak-charm-zodiac-horoscope',
    name: 'Vòng Charm Paracord 12 Cung Hoàng Đạo',
    category: 'charm_bracelet',
    price: 79000,
    originalPrice: 99000,
    discountBadge: 'Mẫu Cung Hoàng Đạo',
    image: '/assets/img_0.jpg',
    images: ['/assets/img_0.jpg', '/assets/img_1.jpg', '/assets/image_1.jpg'],
    description: 'Biểu tượng Cung Hoàng Đạo đính kèm trên dải dây Paracord bện kép thủ công. Thiết kế tinh tế, năng lượng may mắn và cá tính.',
    details: [
      'Charm biểu tượng: 12 Cung Hoàng Đạo hợp kim Titan đúc nổi sắc nét',
      'Dây Paracord: Bản phối màu chuẩn theo từng nhóm cung',
      'Khóa bấm hợp kim tiện lợi',
      'Tặng kèm túi rút bảo quản NOT A KNOT'
    ],
    isBestSeller: true,
    isNew: true,
    rating: 4.9,
    reviewsCount: 118,
    stock: 25,
    inStock: true
  },
  {
    id: 'nak-charm-letter-initials',
    name: 'Vòng Charm Paracord Ký Tự A-Z',
    category: 'charm_bracelet',
    price: 65000,
    originalPrice: 85000,
    discountBadge: 'Mẫu Ký Tự',
    image: '/assets/image_1.jpg',
    images: ['/assets/image_1.jpg', '/assets/img_4_NOT_A_KNOT.jpg'],
    description: 'Chiếc vòng ý nghĩa gắn hạt charm chữ cái đúc sắc nét. Tinh tế, hoàn hảo làm vòng đôi hoặc quà lưu niệm phong cách.',
    details: [
      'Hạt charm chữ cái đúc mạ sáng bóng',
      'Đan thủ công tỉ mỉ từng mắt nối',
      'Chống nước hoàn toàn, mang tắm biển thoải mái'
    ],
    rating: 4.9,
    reviewsCount: 144,
    stock: 30,
    inStock: true
  },
  {
    id: 'nak-charm-compass-titan',
    name: 'Vòng Charm Paracord La Bàn Hàng Hải Titan',
    category: 'charm_bracelet',
    price: 89000,
    originalPrice: 115000,
    discountBadge: 'Khám Phá & Phiêu Lưu',
    image: '/assets/img_1.jpg',
    images: ['/assets/img_1.jpg', '/assets/image_0.jpg'],
    description: 'Charm La Bàn (Compass) mang ý nghĩa định hướng vững vàng trong cuộc sống, phối hợp hài hòa trên dây Paracord bện Cobra đôi nam tính.',
    details: [
      'Charm La Bàn: Hợp kim Titan xước cổ điển chống oxy hóa',
      'Khóa chốt: Khóa bấm hợp kim sơn tĩnh điện',
      'Bản rộng: 1.8cm vừa vặn cổ tay nam lẫn nữ'
    ],
    rating: 5.0,
    reviewsCount: 83,
    stock: 20,
    inStock: true
  },
  {
    id: 'nak-charm-anchor-nautical',
    name: 'Vòng Charm Mỏ Neo Thủy Thủ Phong Cách (Nautical Anchor)',
    category: 'charm_bracelet',
    price: 85000,
    originalPrice: 105000,
    discountBadge: 'Phong Cách Biển',
    image: '/assets/image_3.jpg',
    images: ['/assets/image_3.jpg', '/assets/img_0.jpg'],
    description: 'Mỏ neo biểu trưng cho sự kiên định, bình an và niềm tin vượt qua mọi sóng gió, lồng ghép độc đáo như một chốt khóa cài chắc chắn.',
    details: [
      'Khóa mỏ neo đúc khối hợp kim cao cấp mạ bạc Gunmetal',
      'Dây Paracord quấn 2 vòng (Double Wrap) sành điệu',
      'Phù hợp phối đồ phong cách mùa hè, du lịch dã ngoại'
    ],
    rating: 4.9,
    reviewsCount: 71,
    stock: 18,
    inStock: true
  },

  // ==========================================
  // 4. EVERYDAY WEAR (TỐI GIẢN & ĐEO HẰNG NGÀY)
  // ==========================================
  {
    id: 'nak-everyday-slim-cord',
    name: 'Vòng Tay Everyday Slim Minimalist',
    category: 'everyday',
    price: 49000,
    originalPrice: 65000,
    discountBadge: 'Đeo Hàng Ngày',
    image: '/assets/img_1_Vng_tay_P.jpg',
    images: ['/assets/img_1_Vng_tay_P.jpg', '/assets/image_4.jpg'],
    description: 'Thiết kế tối giản bản mỏng chỉ 0.8cm, nhẹ bẫng trên tay, không gây cộm khi làm việc văn phòng, gõ bàn phím máy tính hoặc đeo cùng đồng hồ.',
    details: [
      'Trọng lượng siêu nhẹ: Chỉ 12g',
      'Bản dẹp mềm mịn ôm khít cổ tay không cấn',
      'Phù hợp cho cả nam và nữ trong mọi hoạt động thường nhật',
      'Khô thoáng nhanh chóng, không giữ mùi mồ hôi'
    ],
    isBestSeller: true,
    rating: 5.0,
    reviewsCount: 203,
    stock: 50,
    inStock: true
  },
  {
    id: 'nak-everyday-lanyard-tag',
    name: 'Dây Đeo Thẻ & Chìa Khóa Everyday Lanyard',
    category: 'everyday',
    price: 55000,
    originalPrice: 70000,
    discountBadge: 'Tiện Ích Văn Phòng',
    image: '/assets/image_0.jpg',
    images: ['/assets/image_0.jpg', '/assets/img_0.jpg'],
    description: 'Dây đeo cổ Paracord thời trang cho thẻ nhân viên, thẻ sinh viên, chìa khóa thông minh xe máy và ô tô. Năng động và trẻ trung.',
    details: [
      'Chiều dài chuẩn 45cm vòng qua cổ thoải mái',
      'Móc xoay kim loại không gỉ 360 độ',
      'Kèm vòng cao su co giãn gắn phụ kiện tiện lợi',
      'Chất liệu mềm êm không làm đỏ rát vùng da cổ'
    ],
    isNew: true,
    rating: 4.8,
    reviewsCount: 81,
    stock: 32,
    inStock: true
  },
  {
    id: 'nak-everyday-trilobite-duo',
    name: 'Vòng Paracord Trilobite 2 Màu Tối Giản',
    category: 'everyday',
    price: 59000,
    originalPrice: 75000,
    discountBadge: 'Vân Đan Độc Đáo',
    image: '/assets/image_4.jpg',
    images: ['/assets/image_4.jpg', '/assets/img_1_Vng_tay_P.jpg'],
    description: 'Kiểu đan Trilobite mặt lưng phẳng êm ái, phối 2 đường chỉ màu tương phản mang lại vẻ đẹp hiện đại, thanh thoát.',
    details: [
      'Bản rộng: 1.5cm vừa vặn',
      'Khóa chốt bấm siêu nhẹ chống kẹt',
      'Khô nhanh gấp 3 lần vải thắt thông thường'
    ],
    rating: 4.9,
    reviewsCount: 95,
    stock: 28,
    inStock: true
  },
  {
    id: 'nak-everyday-mini-snake',
    name: 'Vòng Paracord Mini Snake Knot Phối Đồng Hồ',
    category: 'everyday',
    price: 45000,
    originalPrice: 60000,
    discountBadge: 'Phối Đồng Hồ',
    image: '/assets/bracelet.jpg',
    images: ['/assets/bracelet.jpg', '/assets/img_0.jpg'],
    description: 'Chiếc vòng bản nhỏ đan vân rắn Snake Knot mềm dẻo, lý tưởng nhất để đeo cặp cùng Apple Watch, đồng hồ cơ và vòng chuỗi hạt.',
    details: [
      'Đường kính đan chỉ 6mm cực kỳ mảnh',
      'Khóa rút điều chỉnh kích thước linh hoạt',
      'Êm ái không gây trầy xước viền đồng hồ'
    ],
    rating: 4.8,
    reviewsCount: 112,
    stock: 45,
    inStock: true
  },
  {
    id: 'nak-everyday-infinity-couple',
    name: 'Vòng Đôi Paracord Vô Cực Infinity Minimalist (Set 2 Chiếc)',
    category: 'everyday',
    price: 99000,
    originalPrice: 140000,
    discountBadge: 'Set Vòng Cặp Đôi',
    image: '/assets/image_4.jpg',
    images: ['/assets/image_4.jpg', '/assets/img_1_Vng_tay_P.jpg'],
    description: 'Set 2 chiếc vòng tay biểu tượng Vô Cực (Infinity) đan từ sợi Paracord mảnh thanh lịch, minh chứng cho sự gắn kết vĩnh cửu không rời.',
    details: [
      'Bao gồm: 01 Vòng Nam (17cm) + 01 Vòng Nữ (15cm) có chốt điều chỉnh',
      'Charm Vô Cực bằng Titan xước không gỉ sét',
      'Tặng kèm hộp quà đôi sang trọng'
    ],
    isBestSeller: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 167,
    stock: 35,
    inStock: true
  },
  {
    id: 'nak-everyday-matte-stealth',
    name: 'Vòng Paracord Stealth Matte Black Ultra Slim 6mm',
    category: 'everyday',
    price: 52000,
    originalPrice: 70000,
    discountBadge: 'Bản Đen Mờ Nhám',
    image: '/assets/img_1_Vng_tay_P.jpg',
    images: ['/assets/img_1_Vng_tay_P.jpg', '/assets/bracelet.jpg'],
    description: 'Phong cách Ninja Stealth đen mờ tuyệt đối. Bện chặt từ sợi Micro Cord phủ sáp mờ chống bám bụi, kháng nước tuyệt đối.',
    details: [
      'Bản mỏng chỉ 6mm, khóa chốt trượt hợp kim PVD mờ',
      'Trọng lượng siêu nhẹ chỉ 8g',
      'Hoàn hảo cho người thích phong cách Dark Wear & Minimalist'
    ],
    isNew: true,
    rating: 4.9,
    reviewsCount: 84,
    stock: 40,
    inStock: true
  },

  // ==========================================
  // 5. VÒNG PARACORD 550 CƠ BẢN (BRACELETS)
  // ==========================================
  {
    id: 'nak-bracelets-titanium-shackle',
    name: 'Vòng Paracord Chiến Thuật Khóa Móng Ngựa Titan Chống Xước Pro',
    category: 'bracelets',
    price: 119000,
    originalPrice: 155000,
    discountBadge: 'Titanium Grade 5',
    image: '/assets/img_1.jpg',
    images: ['/assets/img_1.jpg', '/assets/img_4.jpg', '/assets/bracelet.jpg'],
    description: 'Phiên bản chiến thuật đỉnh cao với chốt khóa móng ngựa Titanium Grade 5 siêu nhẹ, chống trầy xước và chịu lực tải kéo vượt trội 300kg.',
    details: [
      'Khóa móng ngựa Titanium Grade 5 gia công CNC chính xác',
      'Kiểu dệt King Cobra kép 4 lớp chứa 4.2m dây cứu sinh',
      'Chống ăn mòn tuyệt đối trong nước biển mặn và hóa chất',
      'Khắc laser logo NOT A KNOT sắc nét'
    ],
    isBestSeller: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 178,
    stock: 20,
    inStock: true
  },
  {
    id: 'nak-bracelet-cobra-tactical',
    name: 'Vòng Paracord Cobra Tactical Shackle',
    category: 'bracelets',
    price: 89000,
    originalPrice: 110000,
    discountBadge: 'Tiết kiệm 19%',
    image: '/assets/img_1.jpg',
    images: ['/assets/img_1.jpg', '/assets/image_0.jpg', '/assets/bracelet.jpg'],
    description: 'Vòng tay Paracord phong cách quân đội bản dày, dệt theo kiểu Cobra Weave với chốt khóa móng ngựa (Shackle) thép đen cá tính.',
    details: [
      'Chất liệu: Dây Paracord 550lb chính hãng chống mục',
      'Khóa: Shackle thép không gỉ sơn tĩnh điện',
      'Bản rộng: 2.2cm, dệt kép chắc chắn',
      'Có 3 nấc điều chỉnh độ ôm cổ tay',
      'Thích hợp đi phượt, dã ngoại, thể thao'
    ],
    isBestSeller: true,
    rating: 5.0,
    reviewsCount: 215,
    stock: 22,
    inStock: true
  },
  {
    id: 'nak-bracelet-fishtail-duo',
    name: 'Vòng Paracord Fishtail Phối Kép',
    category: 'bracelets',
    price: 65000,
    originalPrice: 85000,
    discountBadge: 'Tiết kiệm 23%',
    image: '/assets/image_4.jpg',
    images: ['/assets/image_4.jpg', '/assets/img_0.jpg'],
    description: 'Thiết kế dáng dẹp thanh lịch đan theo vân đuôi cá (Fishtail Knot) phối 2 dải màu tinh tế. Kiểu dáng gọn gàng, mềm mại khi đeo hàng ngày.',
    details: [
      'Kiểu đan: Fishtail Weave bản mỏng 1.4cm',
      'Khóa: Khóa cài nam châm hút hoặc chốt bấm micro',
      'Mềm mại, không gây cấn tay khi gõ phím',
      'Khô thoáng nhanh khi tiếp xúc với nước'
    ],
    isNew: true,
    rating: 4.8,
    reviewsCount: 89,
    stock: 24,
    inStock: true
  },
  {
    id: 'nak-bracelet-trilobite-titan',
    name: 'Vòng Paracord King Cobra Extreme Sinh Tồn',
    category: 'bracelets',
    price: 125000,
    originalPrice: 150000,
    discountBadge: 'Tiết kiệm 17%',
    image: '/assets/img_4.jpg',
    images: ['/assets/img_4.jpg', '/assets/img_1.jpg'],
    description: 'Phiên bản dệt cực đại với hơn 4.5 mét dây Paracord trong một chiếc vòng. Tích hợp còi cứu hộ và thanh đánh lửa sinh tồn mini trên khóa chốt.',
    details: [
      'Tích hợp: Còi sinh tồn 100dB và thanh đánh lửa Magie',
      'Chiều dài dây khi tháo mở: 4.5 - 5 mét',
      'Lực căng đứt dây: 550 pounds (249kg)',
      'Bảo hành đổi mới chốt khóa trong 12 tháng'
    ],
    rating: 4.9,
    reviewsCount: 64,
    stock: 15,
    inStock: true
  },
  {
    id: 'nak-bracelet-spartan-warrior',
    name: 'Vòng Paracord Chiến Binh Spartan Khóa Kim Loại',
    category: 'bracelets',
    price: 99000,
    originalPrice: 130000,
    discountBadge: 'Chiến Binh EDC',
    image: '/assets/image_2.jpg',
    images: ['/assets/image_2.jpg', '/assets/img_1.jpg'],
    description: 'Đầu khóa hình nón mũ giáp Chiến Binh Spartan bằng đồng đúc khối uy lực, bện dây Paracord kiểu Dragon Claw móng rồng mạnh mẽ.',
    details: [
      'Khóa mũ giáp Spartan đúc khối sắc sảo từng chi tiết',
      'Dây Paracord 550 dệt 3 lõi dày dặn chịu lực cao',
      'Phong cách đậm chất nam tính và kiên cường'
    ],
    rating: 5.0,
    reviewsCount: 98,
    stock: 19,
    inStock: true
  },
  {
    id: 'nak-couple-set-fixed',
    name: 'Bộ Vòng Đôi Paracord Bền Chặt (Set 2 Vòng)',
    category: 'bracelets',
    price: 119000,
    originalPrice: 150000,
    discountBadge: 'Set Vòng Đôi',
    image: '/assets/img_4_NOT_A_KNOT.jpg',
    images: ['/assets/img_4_NOT_A_KNOT.jpg', '/assets/image_4.jpg'],
    description: 'Cặp vòng tay thủ công phối màu đôi hài hòa, mang ý nghĩa bền bỉ và gắn kết. Tặng kèm hộp quà NOT A KNOT sang trọng.',
    details: [
      'Gồm: Set 2 vòng tay (1 Size Nam 17cm + 1 Size Nữ 15cm)',
      'Khóa bấm hợp kim chắc chắn',
      'Tặng kèm hộp quà trang nhã',
      'Bảo hành làm mới và thắt lại trọn đời'
    ],
    isBestSeller: true,
    rating: 5.0,
    reviewsCount: 310,
    stock: 16,
    inStock: true
  },
  {
    id: 'nak-pet-collar-fixed',
    name: 'Vòng Cổ Thú Cưng Paracord 550',
    category: 'bracelets',
    price: 95000,
    originalPrice: 120000,
    discountBadge: 'Tiết kiệm 21%',
    image: '/assets/image_2.jpg',
    images: ['/assets/image_2.jpg', '/assets/bracelet.jpg'],
    description: 'Vòng cổ cho thú cưng đan thủ công từ dây dù chống rách, không bám lông, dễ giặt sạch. Tích hợp khuyên móc thẻ bài.',
    details: [
      'Không bai dão khi thú cưng kéo giật mạnh',
      'Dễ giặt sạch và khô nhanh gấp 3 lần vải thường',
      'Khóa bấm nhựa kỹ thuật bo tròn êm ái'
    ],
    rating: 4.8,
    reviewsCount: 43,
    stock: 14,
    inStock: true
  },

  // ==========================================
  // 6. MÓC KHÓA & PHỤ KIỆN EDC (KEYCHAINS)
  // ==========================================
  {
    id: 'nak-keychain-diamond-brass',
    name: 'Móc Khóa Paracord Diamond & Charm Đồng',
    category: 'keychains',
    price: 49000,
    originalPrice: 65000,
    discountBadge: 'Tiết kiệm 25%',
    image: '/assets/img_2.jpg',
    images: ['/assets/img_2.jpg', '/assets/img_3.jpg'],
    description: 'Móc khóa đan nút kim cương cổ điển kết hợp hạt charm đồng nguyên khối chạm khắc hoa văn tinh xảo. Nhỏ gọn, chắc chắn.',
    details: [
      'Chất liệu hạt: Hạt bead đồng thau nguyên chất chống oxy hóa',
      'Khuyên móc dẹp đường kính 30mm mạ titan gunmetal',
      'Độ dài tổng thể: 12cm',
      'Đan thủ công 100% không bung tuột'
    ],
    isBestSeller: true,
    rating: 4.9,
    reviewsCount: 142,
    stock: 45,
    inStock: true
  },
  {
    id: 'nak-keychain-carabiner-tactical',
    name: 'Móc Khóa Dã Ngoại Quick-Clip Carabiner',
    category: 'keychains',
    price: 59000,
    originalPrice: 75000,
    discountBadge: 'Tiết kiệm 21%',
    image: '/assets/image_3.jpg',
    images: ['/assets/image_3.jpg', '/assets/keychain-bodoi.jpg'],
    description: 'Móc khóa đa năng tích hợp móc Carabiner hợp kim nhôm chịu lực. Dễ dàng móc vào đỉa quần, quai balo, treo bình nước khi dã ngoại.',
    details: [
      'Móc Carabiner hợp kim sơn mờ cao cấp',
      'Đoạn đan Snake Knot trợ lực chắc chắn',
      'Tải trọng tĩnh móc nhôm: 30kg',
      'Trọng lượng siêu nhẹ chỉ 28g'
    ],
    rating: 4.8,
    reviewsCount: 57,
    stock: 20,
    inStock: true
  },
  {
    id: 'nak-keychain-monkey-fist',
    name: 'Móc Khóa Paracord Quả Cầu Monkey Fist',
    category: 'keychains',
    price: 65000,
    originalPrice: 85000,
    discountBadge: 'Thiết Kế Cổ Điển',
    image: '/assets/img_3.jpg',
    images: ['/assets/img_3.jpg', '/assets/image_2.jpg'],
    description: 'Móc khóa đan kiểu nắm đấm khỉ Monkey Fist bọc bi thép nặng đầm tay bên trong, vừa là móc khóa EDC phong cách vừa là vật phòng thân hữu ích.',
    details: [
      'Bên trong bọc bi thép đường kính 20mm đầm tay',
      'Dây đan Paracord bện 8 lớp chặt chẽ',
      'Kèm khuyên tròn thép titan không rỉ'
    ],
    rating: 4.9,
    reviewsCount: 88,
    stock: 22,
    inStock: true
  },
  {
    id: 'nak-keychain-skull-bead',
    name: 'Móc Khóa Paracord Skull Bead Đúc Khối Sắc Nét',
    category: 'keychains',
    price: 55000,
    originalPrice: 70000,
    discountBadge: 'Phong Cách Bụi Bặm',
    image: '/assets/img_2_Mc_kho_C.jpg',
    images: ['/assets/img_2_Mc_kho_C.jpg', '/assets/img_2.jpg'],
    description: 'Hạt bead đầu lâu Skull bằng kim loại hợp kim tạo điểm nhấn góc cạnh và bụi bặm cho chùm chìa khóa xe máy, ô tô.',
    details: [
      'Hạt Skull mạ bạc xước Vintage hoặc đen Gunmetal',
      'Dây Paracord đan nút xoắn bền bỉ',
      'Trọng lượng nhẹ 20g'
    ],
    rating: 4.8,
    reviewsCount: 63,
    stock: 35,
    inStock: true
  },
  {
    id: 'nak-keychains-heavy-shackle',
    name: 'Móc Khóa Paracord Heavy-Duty Khóa Chốt Vặn Móng Ngựa Thép Đen',
    category: 'keychains',
    price: 69000,
    originalPrice: 90000,
    discountBadge: 'Heavy-Duty EDC',
    image: '/assets/img_2_Mc_kho_C.jpg',
    images: ['/assets/img_2_Mc_kho_C.jpg', '/assets/keychain-bodoi.jpg'],
    description: 'Móc khóa sinh tồn chịu lực cực đại với chốt vặn Shackle thép đúc sơn tĩnh điện không gỉ, đan nút Diamond Knot kép siêu chắc chắn.',
    details: [
      'Khóa chốt vặn Ren Shackle chống bung tuột tuyệt đối',
      'Đan thủ công từ 2.5 mét dây Paracord 550 nguyên bản',
      'Chịu tải tĩnh lên đến 150kg'
    ],
    isBestSeller: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 91,
    stock: 25,
    inStock: true
  },

  // ==========================================
  // 7. DÂY ĐEO ĐA NĂNG & LANYARD (LANYARDS)
  // ==========================================
  {
    id: 'nak-lanyards-cyber-titanium',
    name: 'Dây Rút Lanyard Dao Gấp & Bút EDC Hạt Cyberpunk Titan',
    category: 'lanyards',
    price: 89000,
    originalPrice: 120000,
    discountBadge: 'Cyberpunk Titan',
    image: '/assets/image_3.jpg',
    images: ['/assets/image_3.jpg', '/assets/image_0.jpg'],
    description: 'Dây rút trang trí chuôi dao gấp Victorinox, kéo tỉa cây cảnh mini, đèn pin EDC và bút ký. Đính hạt Bead phong cách Cyberpunk bằng hợp kim Titan xước xát tinh xảo.',
    details: [
      'Hạt Bead Titan chạm khắc hình học viễn tưởng siêu nhẹ',
      'Đan nút Snake Knot kép cố định không xê dịch',
      'Giúp rút nhanh dao/đèn pin từ túi quần chỉ trong 0.5s'
    ],
    isNew: true,
    rating: 5.0,
    reviewsCount: 62,
    stock: 20,
    inStock: true
  },
  {
    id: 'nak-lanyard-phone-camera',
    name: 'Dây Đeo Điện Thoại & Máy Ảnh Paracord',
    category: 'lanyards',
    price: 79000,
    originalPrice: 99000,
    discountBadge: 'Tiết kiệm 20%',
    image: '/assets/image_0.jpg',
    images: ['/assets/image_0.jpg', '/assets/img_0.jpg'],
    description: 'Dây đeo cổ tay và đeo cổ tiện lợi cho điện thoại, máy ảnh mirrorless, thẻ nhân viên. Tặng kèm miếng pad chèn ốp lưng chịu lực siêu bền.',
    details: [
      'Kích thước chuẩn: Bản đeo tay (35cm) hoặc bản đeo cổ (110cm)',
      'Khóa bấm chắc chắn giữ an toàn thiết bị',
      'Kèm sẵn pad treo điện thoại dẻo dai chống đứt',
      'Mềm êm không cọ rát vùng cổ hay cổ tay'
    ],
    isNew: true,
    rating: 5.0,
    reviewsCount: 88,
    stock: 35,
    inStock: true
  },
  {
    id: 'nak-lanyard-crossbody-strap',
    name: 'Dây Đeo Chéo Crossbody Paracord 550 Đa Năng',
    category: 'lanyards',
    price: 99000,
    originalPrice: 135000,
    discountBadge: 'Trend Crossbody',
    image: '/assets/img_0.jpg',
    images: ['/assets/img_0.jpg', '/assets/image_0.jpg'],
    description: 'Dây đeo chéo thời thượng dài 120cm cho điện thoại, túi mini, máy ảnh du lịch. Bện từ 4 sợi Paracord xoắn kép siêu êm vai.',
    details: [
      'Chiều dài 120cm đan chéo vai cực kỳ thoải mái',
      'Khóa xoay 360 độ mạ hợp kim Titan',
      'Tặng kèm 2 pad lót ốp điện thoại chống giật rơi'
    ],
    isBestSeller: true,
    isNew: true,
    rating: 5.0,
    reviewsCount: 104,
    stock: 26,
    inStock: true
  },
  {
    id: 'nak-lanyard-wrist-camera',
    name: 'Dây Đeo Cổ Tay Máy Ảnh DSLR & GoPro Chống Rơi',
    category: 'lanyards',
    price: 55000,
    originalPrice: 75000,
    discountBadge: 'An Toàn Thiết Bị',
    image: '/assets/image_3.jpg',
    images: ['/assets/image_3.jpg', '/assets/image_0.jpg'],
    description: 'Dây an toàn chống rơi cho máy ảnh, gimbal, action camera khi tác nghiệp ngoài trời. Chốt rút khóa tự thắt chặt khi tuột tay.',
    details: [
      'Chốt rút điều chỉnh tự động khóa ôm cổ tay khi có lực rơi',
      'Dây chịu tải đứt đến 150kg an toàn tuyệt đối',
      'Mềm mại không trầy xước thân máy ảnh'
    ],
    rating: 4.9,
    reviewsCount: 77,
    stock: 28,
    inStock: true
  }
];

export const BRAND_VALUES = [
  {
    icon: 'ShieldCheck',
    title: 'Paracord 550 Type III',
    description: 'Lõi 7 sợi bện kép chịu tải trọng tới 250kg, chống mục nát, chống tia UV và bền màu theo năm tháng.'
  },
  {
    icon: 'Hammer',
    title: '100% Đan Thủ Công',
    description: 'Từng mắt đan được thợ thủ công NOT A KNOT tỉ mỉ thắt nút với lực căng đồng đều hoàn hảo.'
  },
  {
    icon: 'Sparkles',
    title: 'Thiết Kế Tinh Tuyển',
    description: 'Sản phẩm hoàn thiện theo quy chuẩn phom dáng, phối màu chuẩn mực và thẩm mỹ tối giản.'
  },
  {
    icon: 'RefreshCw',
    title: 'Bảo Hành Trọn Đời',
    description: 'Cam kết bảo hành đan lại trọn đời nếu bị đứt sút nút thắt và hỗ trợ làm mới miễn phí.'
  }
];

export const KNOT_TYPES = [
  {
    name: 'Cobra Weave',
    desc: 'Kiểu đan kinh điển nhất trong giới Paracord, ôm sát cổ tay, bề mặt phẳng mịn và vô cùng chắc chắn.',
    badge: 'Phổ biến'
  },
  {
    name: 'King Cobra',
    desc: 'Được dệt 2 lớp chồng lên nhau, bản rộng 2.5cm tạo cảm giác mạnh mẽ, chứa lượng dây sinh tồn nhiều gấp đôi.',
    badge: 'Chiến thuật'
  },
  {
    name: 'Fishtail',
    desc: 'Kiểu dệt mảnh mai, thanh thoát và đàn hồi nhẹ, rất êm tay khi đeo cùng đồng hồ hoặc vòng tay khác.',
    badge: 'Thanh lịch'
  },
  {
    name: 'Diamond Knot',
    desc: 'Nút thắt hình khối 3D vững chãi ở phần chuôi móc khóa EDC, chống trơn trượt khi cầm nắm.',
    badge: 'EDC Icon'
  }
];
