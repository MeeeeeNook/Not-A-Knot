export interface ProvinceData {
  name: string;
  code: string;
  districts: string[];
}

// Danh mục 63 Tỉnh / Thành phố và Quận / Huyện / Thị xã / TP thuộc tỉnh mới nhất của Việt Nam
export const VIETNAM_PROVINCES: ProvinceData[] = [
  {
    name: 'Hà Nội',
    code: 'HN',
    districts: [
      'Quận Hai Bà Trưng',
      'Quận Ba Đình',
      'Quận Hoàn Kiếm',
      'Quận Đống Đa',
      'Quận Cầu Giấy',
      'Quận Tây Hồ',
      'Quận Thanh Xuân',
      'Quận Hoàng Mai',
      'Quận Long Biên',
      'Quận Nam Từ Liêm',
      'Quận Bắc Từ Liêm',
      'Quận Hà Đông',
      'Thị xã Sơn Tây',
      'Huyện Ba Vì',
      'Huyện Chương Mỹ',
      'Huyện Đan Phượng',
      'Huyện Đông Anh',
      'Huyện Gia Lâm',
      'Huyện Hoài Đức',
      'Huyện Mê Linh',
      'Huyện Mỹ Đức',
      'Huyện Phú Xuyên',
      'Huyện Phúc Thọ',
      'Huyện Quốc Oai',
      'Huyện Sóc Sơn',
      'Huyện Thạch Thất',
      'Huyện Thanh Oai',
      'Huyện Thanh Trì',
      'Huyện Thường Tín',
      'Huyện Ứng Hòa'
    ]
  },
  {
    name: 'TP. Hồ Chí Minh',
    code: 'HCM',
    districts: [
      'Thành phố Thủ Đức',
      'Quận 1',
      'Quận 3',
      'Quận 4',
      'Quận 5',
      'Quận 6',
      'Quận 7',
      'Quận 8',
      'Quận 10',
      'Quận 11',
      'Quận 12',
      'Quận Bình Thạnh',
      'Quận Gò Vấp',
      'Quận Phú Nhuận',
      'Quận Tân Bình',
      'Quận Tân Phú',
      'Quận Bình Tân',
      'Huyện Bình Chánh',
      'Huyện Cần Giờ',
      'Huyện Củ Chi',
      'Huyện Hóc Môn',
      'Huyện Nhà Bè'
    ]
  },
  {
    name: 'Đà Nẵng',
    code: 'DN',
    districts: [
      'Quận Hải Châu',
      'Quận Thanh Khê',
      'Quận Sơn Trà',
      'Quận Ngũ Hành Sơn',
      'Quận Liên Chiểu',
      'Quận Cẩm Lệ',
      'Huyện Hòa Vang',
      'Huyện Hoàng Sa'
    ]
  },
  {
    name: 'Hải Phòng',
    code: 'HP',
    districts: [
      'Quận Hồng Bàng',
      'Quận Ngô Quyền',
      'Quận Lê Chân',
      'Quận Hải An',
      'Quận Kiến An',
      'Quận Đồ Sơn',
      'Quận Dương Kinh',
      'Huyện Thủy Nguyên',
      'Huyện An Dương',
      'Huyện An Lão',
      'Huyện Kiến Thụy',
      'Huyện Tiên Lãng',
      'Huyện Vĩnh Bảo',
      'Huyện Cát Hải',
      'Huyện Bạch Long Vĩ'
    ]
  },
  {
    name: 'Cần Thơ',
    code: 'CT',
    districts: [
      'Quận Ninh Kiều',
      'Quận Bình Thủy',
      'Quận Cái Răng',
      'Quận Ô Môn',
      'Quận Thốt Nốt',
      'Huyện Phong Điền',
      'Huyện Cờ Đỏ',
      'Huyện Thới Lai',
      'Huyện Vĩnh Thạnh'
    ]
  },
  {
    name: 'An Giang',
    code: 'AG',
    districts: ['Thành phố Long Xuyên', 'Thành phố Châu Đốc', 'Thị xã Tân Châu', 'Thị xã Tịnh Biên', 'Huyện An Phú', 'Huyện Châu Phú', 'Huyện Châu Thành', 'Huyện Chợ Mới', 'Huyện Phú Tân', 'Huyện Thoại Sơn', 'Huyện Tri Tôn']
  },
  {
    name: 'Bà Rịa - Vũng Tàu',
    code: 'BV',
    districts: ['Thành phố Vũng Tàu', 'Thành phố Bà Rịa', 'Thị xã Phú Mỹ', 'Huyện Châu Đức', 'Huyện Côn Đảo', 'Huyện Đất Đỏ', 'Huyện Long Điền', 'Huyện Xuyên Mộc']
  },
  {
    name: 'Bắc Giang',
    code: 'BG',
    districts: ['Thành phố Bắc Giang', 'Thị xã Việt Yên', 'Huyện Hiệp Hòa', 'Huyện Lạng Giang', 'Huyện Lục Nam', 'Huyện Lục Ngạn', 'Huyện Sơn Động', 'Huyện Tân Yên', 'Huyện Yên Dũng', 'Huyện Yên Thế']
  },
  {
    name: 'Bắc Kạn',
    code: 'BK',
    districts: ['Thành phố Bắc Kạn', 'Huyện Ba Bể', 'Huyện Bạch Thông', 'Huyện Chợ Đồn', 'Huyện Chợ Mới', 'Huyện Na Rì', 'Huyện Ngân Sơn', 'Huyện Pác Nặm']
  },
  {
    name: 'Bạc Liêu',
    code: 'BL',
    districts: ['Thành phố Bạc Liêu', 'Thị xã Giá Rai', 'Huyện Đông Hải', 'Huyện Hòa Bình', 'Huyện Hồng Dân', 'Huyện Phước Long', 'Huyện Vĩnh Lợi']
  },
  {
    name: 'Bắc Ninh',
    code: 'BN',
    districts: ['Thành phố Bắc Ninh', 'Thành phố Từ Sơn', 'Thị xã Quế Võ', 'Thị xã Thuận Thành', 'Huyện Gia Bình', 'Huyện Lương Tài', 'Huyện Tiên Du', 'Huyện Yên Phong']
  },
  {
    name: 'Bến Tre',
    code: 'BT',
    districts: ['Thành phố Bến Tre', 'Huyện Ba Tri', 'Huyện Bình Đại', 'Huyện Châu Thành', 'Huyện Chợ Lách', 'Huyện Giồng Trôm', 'Huyện Mỏ Cày Bắc', 'Huyện Mỏ Cày Nam', 'Huyện Thạnh Phú']
  },
  {
    name: 'Bình Định',
    code: 'BDH',
    districts: ['Thành phố Quy Nhơn', 'Thị xã An Nhơn', 'Thị xã Hoài Nhơn', 'Huyện An Lão', 'Huyện Hoài Ân', 'Huyện Phù Cát', 'Huyện Phù Mỹ', 'Huyện Tuy Phước', 'Huyện Tây Sơn', 'Huyện Vân Canh', 'Huyện Vĩnh Thạnh']
  },
  {
    name: 'Bình Dương',
    code: 'BD',
    districts: ['Thành phố Thủ Dầu Một', 'Thành phố Dĩ An', 'Thành phố Thuận An', 'Thành phố Tân Uyên', 'Thành phố Bến Cát', 'Huyện Bàu Bàng', 'Huyện Dầu Tiếng', 'Huyện Phú Giáo', 'Huyện Bắc Tân Uyên']
  },
  {
    name: 'Bình Phước',
    code: 'BP',
    districts: ['Thành phố Đồng Xoài', 'Thị xã Bình Long', 'Thị xã Phước Long', 'Thị xã Chơn Thành', 'Huyện Bù Đăng', 'Huyện Bù Đốp', 'Huyện Bù Gia Mập', 'Huyện Đồng Phú', 'Huyện Hớn Quản', 'Huyện Lộc Ninh', 'Huyện Phú Riềng']
  },
  {
    name: 'Bình Thuận',
    code: 'BTH',
    districts: ['Thành phố Phan Thiết', 'Thị xã La Gi', 'Huyện Tuy Phong', 'Huyện Bắc Bình', 'Huyện Hàm Thuận Bắc', 'Huyện Hàm Thuận Nam', 'Huyện Hàm Tân', 'Huyện Đức Linh', 'Huyện Tánh Linh', 'Huyện Phú Quý']
  },
  {
    name: 'Cà Mau',
    code: 'CM',
    districts: ['Thành phố Cà Mau', 'Huyện Cái Nước', 'Huyện Đầm Dơi', 'Huyện Năm Căn', 'Huyện Ngọc Hiển', 'Huyện Phú Tân', 'Huyện Thới Bình', 'Huyện Trần Văn Thời', 'Huyện U Minh']
  },
  {
    name: 'Cao Bằng',
    code: 'CB',
    districts: ['Thành phố Cao Bằng', 'Huyện Bảo Lạc', 'Huyện Bảo Lâm', 'Huyện Hạ Lang', 'Huyện Hà Quảng', 'Huyện Hòa An', 'Huyện Nguyên Bình', 'Huyện Quảng Hòa', 'Huyện Thạch An', 'Huyện Trùng Khánh']
  },
  {
    name: 'Đắk Lắk',
    code: 'DL',
    districts: ['Thành phố Buôn Ma Thuột', 'Thị xã Buôn Hồ', 'Huyện Buôn Đôn', 'Huyện Cư Kuin', 'Huyện Cư M\'gar', 'Huyện Ea H\'leo', 'Huyện Ea Kar', 'Huyện Ea Súp', 'Huyện Krông Ana', 'Huyện Krông Bông', 'Huyện Krông Búk', 'Huyện Krông Năng', 'Huyện Krông Pắc', 'Huyện Lắk', 'Huyện M\'Drắk']
  },
  {
    name: 'Đắk Nông',
    code: 'DKN',
    districts: ['Thành phố Gia Nghĩa', 'Huyện Cư Jút', 'Huyện Đắk Glong', 'Huyện Đắk Mil', 'Huyện Đắk R\'lấp', 'Huyện Đắk Song', 'Huyện Krông Nô', 'Huyện Tuy Đức']
  },
  {
    name: 'Điện Biên',
    code: 'DB',
    districts: ['Thành phố Điện Biên Phủ', 'Thị xã Mường Lay', 'Huyện Điện Biên', 'Huyện Điện Biên Đông', 'Huyện Mường Ảng', 'Huyện Mường Chà', 'Huyện Mường Nhé', 'Huyện Nậm Pồ', 'Huyện Tủa Chùa', 'Huyện Tuần Giáo']
  },
  {
    name: 'Đồng Nai',
    code: 'DNA',
    districts: ['Thành phố Biên Hòa', 'Thành phố Long Khánh', 'Huyện Cẩm Mỹ', 'Huyện Định Quán', 'Huyện Long Thành', 'Huyện Nhơn Trạch', 'Huyện Tân Phú', 'Huyện Thống Nhất', 'Huyện Trảng Bom', 'Huyện Vĩnh Cửu', 'Huyện Xuân Lộc']
  },
  {
    name: 'Đồng Tháp',
    code: 'DT',
    districts: ['Thành phố Cao Lãnh', 'Thành phố Sa Đéc', 'Thành phố Hồng Ngự', 'Huyện Cao Lãnh', 'Huyện Châu Thành', 'Huyện Hồng Ngự', 'Huyện Lai Vung', 'Huyện Lấp Vò', 'Huyện Tam Nông', 'Huyện Tân Hồng', 'Huyện Thanh Bình', 'Huyện Tháp Mười']
  },
  {
    name: 'Gia Lai',
    code: 'GL',
    districts: ['Thành phố Pleiku', 'Thị xã An Khê', 'Thị xã Ayun Pa', 'Huyện Chư Păh', 'Huyện Chư Prông', 'Huyện Chư Pưh', 'Huyện Chư Sê', 'Huyện Đắk Đoa', 'Huyện Đắk Pơ', 'Huyện Đức Cơ', 'Huyện Ia Grai', 'Huyện Ia Pa', 'Huyện KBang', 'Huyện Kông Chro', 'Huyện Krông Pa', 'Huyện Mang Yang', 'Huyện Phú Thiện']
  },
  {
    name: 'Hà Giang',
    code: 'HG',
    districts: ['Thành phố Hà Giang', 'Huyện Bắc Mê', 'Huyện Bắc Quang', 'Huyện Đồng Văn', 'Huyện Hoàng Su Phì', 'Huyện Mèo Vạc', 'Huyện Quản Bạ', 'Huyện Quang Bình', 'Huyện Vị Xuyên', 'Huyện Xín Mần', 'Huyện Yên Minh']
  },
  {
    name: 'Hà Nam',
    code: 'HNA',
    districts: ['Thành phố Phủ Lý', 'Thị xã Duy Tiên', 'Huyện Bình Lục', 'Huyện Kim Bảng', 'Huyện Lý Nhân', 'Huyện Thanh Liêm']
  },
  {
    name: 'Hà Tĩnh',
    code: 'HT',
    districts: ['Thành phố Hà Tĩnh', 'Thị xã Hồng Lĩnh', 'Thị xã Kỳ Anh', 'Huyện Cẩm Xuyên', 'Huyện Can Lộc', 'Huyện Đức Thọ', 'Huyện Hương Khê', 'Huyện Hương Sơn', 'Huyện Kỳ Anh', 'Huyện Lộc Hà', 'Huyện Nghi Xuân', 'Huyện Thạch Hà', 'Huyện Vũ Quang']
  },
  {
    name: 'Hải Dương',
    code: 'HD',
    districts: ['Thành phố Hải Dương', 'Thành phố Chí Linh', 'Thị xã Kinh Môn', 'Huyện Bình Giang', 'Huyện Cẩm Giàng', 'Huyện Gia Lộc', 'Huyện Kim Thành', 'Huyện Nam Sách', 'Huyện Ninh Giang', 'Huyện Thanh Hà', 'Huyện Thanh Miện', 'Huyện Tứ Kỳ']
  },
  {
    name: 'Hậu Giang',
    code: 'HGI',
    districts: ['Thành phố Vị Thanh', 'Thành phố Ngã Bảy', 'Thị xã Long Mỹ', 'Huyện Châu Thành', 'Huyện Châu Thành A', 'Huyện Phụng Hiệp', 'Huyện Vị Thủy', 'Huyện Long Mỹ']
  },
  {
    name: 'Hòa Bình',
    code: 'HB',
    districts: ['Thành phố Hòa Bình', 'Huyện Cao Phong', 'Huyện Đà Bắc', 'Huyện Kim Bôi', 'Huyện Lạc Sơn', 'Huyện Lạc Thủy', 'Huyện Lương Sơn', 'Huyện Mai Châu', 'Huyện Tân Lạc', 'Huyện Yên Thủy']
  },
  {
    name: 'Hưng Yên',
    code: 'HY',
    districts: ['Thành phố Hưng Yên', 'Thị xã Mỹ Hào', 'Huyện Ân Thi', 'Huyện Khoái Châu', 'Huyện Kim Động', 'Huyện Phù Cừ', 'Huyện Tiên Lữ', 'Huyện Văn Giang', 'Huyện Văn Lâm', 'Huyện Yên Mỹ']
  },
  {
    name: 'Khánh Hòa',
    code: 'KH',
    districts: ['Thành phố Nha Trang', 'Thành phố Cam Ranh', 'Thị xã Ninh Hòa', 'Huyện Cam Lâm', 'Huyện Diên Khánh', 'Huyện Khánh Sơn', 'Huyện Khánh Vĩnh', 'Huyện Trường Sa', 'Huyện Vạn Ninh']
  },
  {
    name: 'Kiên Giang',
    code: 'KG',
    districts: ['Thành phố Rạch Giá', 'Thành phố Hà Tiên', 'Thành phố Phú Quốc', 'Huyện An Biên', 'Huyện An Minh', 'Huyện Châu Thành', 'Huyện Giang Thành', 'Huyện Giồng Riềng', 'Huyện Gò Quao', 'Huyện Hòn Đất', 'Huyện Kiên Hải', 'Huyện Kiên Lương', 'Huyện Tân Hiệp', 'Huyện U Minh Thượng', 'Huyện Vĩnh Thuận']
  },
  {
    name: 'Kon Tum',
    code: 'KT',
    districts: ['Thành phố Kon Tum', 'Huyện Đắk Glei', 'Huyện Đắk Hà', 'Huyện Đắk Tô', 'Huyện Ia H\'Drai', 'Huyện Kon Plông', 'Huyện Kon Rẫy', 'Huyện Ngọc Hồi', 'Huyện Sa Thầy', 'Huyện Tu Mơ Rông']
  },
  {
    name: 'Lai Châu',
    code: 'LCU',
    districts: ['Thành phố Lai Châu', 'Huyện Mường Tè', 'Huyện Nậm Nhùn', 'Huyện Phong Thổ', 'Huyện Sìn Hồ', 'Huyện Tam Đường', 'Huyện Tân Uyên', 'Huyện Than Uyên']
  },
  {
    name: 'Lâm Đồng',
    code: 'LD',
    districts: ['Thành phố Đà Lạt', 'Thành phố Bảo Lộc', 'Huyện Bảo Lâm', 'Huyện Cát Tiên', 'Huyện Đạ Huoai', 'Huyện Đạ Tẻh', 'Huyện Đam Rông', 'Huyện Di Linh', 'Huyện Đơn Dương', 'Huyện Đức Trọng', 'Huyện Lạc Dương', 'Huyện Lâm Hà']
  },
  {
    name: 'Lạng Sơn',
    code: 'LS',
    districts: ['Thành phố Lạng Sơn', 'Huyện Bắc Sơn', 'Huyện Bình Gia', 'Huyện Cao Lộc', 'Huyện Chi Lăng', 'Huyện Đình Lập', 'Huyện Hữu Lũng', 'Huyện Lộc Bình', 'Huyện Tràng Định', 'Huyện Văn Lãng', 'Huyện Văn Quan']
  },
  {
    name: 'Lào Cai',
    code: 'LCA',
    districts: ['Thành phố Lào Cai', 'Thị xã Sa Pa', 'Huyện Bát Xát', 'Huyện Bảo Thắng', 'Huyện Bảo Yên', 'Huyện Bắc Hà', 'Huyện Mường Khương', 'Huyện Si Ma Cai', 'Huyện Văn Bàn']
  },
  {
    name: 'Long An',
    code: 'LA',
    districts: ['Thành phố Tân An', 'Thị xã Kiến Tường', 'Huyện Bến Lức', 'Huyện Cần Đước', 'Huyện Cần Giuộc', 'Huyện Châu Thành', 'Huyện Đức Hòa', 'Huyện Đức Huệ', 'Huyện Mộc Hóa', 'Huyện Tân Hưng', 'Huyện Tân Thạnh', 'Huyện Tân Trụ', 'Huyện Thạnh Hóa', 'Huyện Thủ Thừa', 'Huyện Vĩnh Hưng']
  },
  {
    name: 'Nam Định',
    code: 'ND',
    districts: ['Thành phố Nam Định', 'Huyện Giao Thủy', 'Huyện Hải Hậu', 'Huyện Mỹ Lộc', 'Huyện Nam Trực', 'Huyện Nghĩa Hưng', 'Huyện Trực Ninh', 'Huyện Vụ Bản', 'Huyện Xuân Trường', 'Huyện Ý Yên']
  },
  {
    name: 'Nghệ An',
    code: 'NA',
    districts: ['Thành phố Vinh', 'Thị xã Cửa Lò', 'Thị xã Hoàng Mai', 'Thị xã Thái Hòa', 'Huyện Anh Sơn', 'Huyện Con Cuông', 'Huyện Diễn Châu', 'Huyện Đô Lương', 'Huyện Hưng Nguyên', 'Huyện Kỳ Sơn', 'Huyện Nam Đàn', 'Huyện Nghi Lộc', 'Huyện Nghĩa Đàn', 'Huyện Quế Phong', 'Huyện Quỳ Châu', 'Huyện Quỳ Hợp', 'Huyện Quỳnh Lưu', 'Huyện Tân Kỳ', 'Huyện Thanh Chương', 'Huyện Tương Dương', 'Huyện Yên Thành']
  },
  {
    name: 'Ninh Bình',
    code: 'NB',
    districts: ['Thành phố Ninh Bình', 'Thành phố Tam Điệp', 'Huyện Gia Viễn', 'Huyện Hoa Lư', 'Huyện Kim Sơn', 'Huyện Nho Quan', 'Huyện Yên Khánh', 'Huyện Yên Mô']
  },
  {
    name: 'Ninh Thuận',
    code: 'NT',
    districts: ['Thành phố Phan Rang - Tháp Chàm', 'Huyện Bác Ái', 'Huyện Ninh Hải', 'Huyện Ninh Phước', 'Huyện Ninh Sơn', 'Huyện Thuận Bắc', 'Huyện Thuận Nam']
  },
  {
    name: 'Phú Thọ',
    code: 'PT',
    districts: ['Thành phố Việt Trì', 'Thị xã Phú Thọ', 'Huyện Cẩm Khê', 'Huyện Đoan Hùng', 'Huyện Hạ Hòa', 'Huyện Lâm Thao', 'Huyện Phù Ninh', 'Huyện Tam Nông', 'Huyện Tân Sơn', 'Huyện Thanh Ba', 'Huyện Thanh Sơn', 'Huyện Thanh Thủy', 'Huyện Yên Lập']
  },
  {
    name: 'Phú Yên',
    code: 'PY',
    districts: ['Thành phố Tuy Hòa', 'Thị xã Sông Cầu', 'Thị xã Đông Hòa', 'Huyện Đồng Xuân', 'Huyện Phú Hòa', 'Huyện Sơn Hòa', 'Huyện Sông Hinh', 'Huyện Tây Hòa', 'Huyện Tuy An']
  },
  {
    name: 'Quảng Bình',
    code: 'QB',
    districts: ['Thành phố Đồng Hới', 'Thị xã Ba Đồn', 'Huyện Bố Trạch', 'Huyện Lệ Thủy', 'Huyện Minh Hóa', 'Huyện Quảng Ninh', 'Huyện Quảng Trạch', 'Huyện Tuyên Hóa']
  },
  {
    name: 'Quảng Nam',
    code: 'QNA',
    districts: ['Thành phố Tam Kỳ', 'Thành phố Hội An', 'Thị xã Điện Bàn', 'Huyện Bắc Trà My', 'Huyện Đại Lộc', 'Huyện Đông Giang', 'Huyện Duy Xuyên', 'Huyện Hiệp Đức', 'Huyện Nam Giang', 'Huyện Nam Trà My', 'Huyện Nông Sơn', 'Huyện Núi Thành', 'Huyện Phú Ninh', 'Huyện Phước Sơn', 'Huyện Quế Sơn', 'Huyện Tây Giang', 'Huyện Thăng Bình', 'Huyện Tiên Phước']
  },
  {
    name: 'Quảng Ngãi',
    code: 'QNG',
    districts: ['Thành phố Quảng Ngãi', 'Thị xã Đức Phổ', 'Huyện Ba Tơ', 'Huyện Bình Sơn', 'Huyện Lý Sơn', 'Huyện Minh Long', 'Huyện Mộ Đức', 'Huyện Nghĩa Hành', 'Huyện Sơn Hà', 'Huyện Sơn Tây', 'Huyện Sơn Tịnh', 'Huyện Trà Bồng', 'Huyện Tư Nghĩa']
  },
  {
    name: 'Quảng Ninh',
    code: 'QN',
    districts: ['Thành phố Hạ Long', 'Thành phố Cẩm Phả', 'Thành phố Móng Cái', 'Thành phố Uông Bí', 'Thị xã Đông Triều', 'Thị xã Quảng Yên', 'Huyện Ba Chẽ', 'Huyện Bình Liêu', 'Huyện Cô Tô', 'Huyện Đầm Hà', 'Huyện Hải Hà', 'Huyện Tiên Yên', 'Huyện Vân Đồn']
  },
  {
    name: 'Quảng Trị',
    code: 'QT',
    districts: ['Thành phố Đông Hà', 'Thị xã Quảng Trị', 'Huyện Cam Lộ', 'Huyện Cồn Cỏ', 'Huyện Đakrông', 'Huyện Gio Linh', 'Huyện Hải Lăng', 'Huyện Hướng Hóa', 'Huyện Triệu Phong', 'Huyện Vĩnh Linh']
  },
  {
    name: 'Sóc Trăng',
    code: 'ST',
    districts: ['Thành phố Sóc Trăng', 'Thị xã Ngã Năm', 'Thị xã Vĩnh Châu', 'Huyện Châu Thành', 'Huyện Cù Lao Dung', 'Huyện Kế Sách', 'Huyện Long Phú', 'Huyện Mỹ Tú', 'Huyện Mỹ Xuyên', 'Huyện Thạnh Trị', 'Huyện Trần Đề']
  },
  {
    name: 'Sơn La',
    code: 'SL',
    districts: ['Thành phố Sơn La', 'Huyện Bắc Yên', 'Huyện Mai Sơn', 'Huyện Mộc Châu', 'Huyện Mường La', 'Huyện Phù Yên', 'Huyện Quỳnh Nhai', 'Huyện Sông Mã', 'Huyện Sốp Cộp', 'Huyện Thuận Châu', 'Huyện Vân Hồ', 'Huyện Yên Châu']
  },
  {
    name: 'Tây Ninh',
    code: 'TN',
    districts: ['Thành phố Tây Ninh', 'Thị xã Hòa Thành', 'Thị xã Trảng Bàng', 'Huyện Bến Cầu', 'Huyện Châu Thành', 'Huyện Dương Minh Châu', 'Huyện Gò Dầu', 'Huyện Tân Biên', 'Huyện Tân Châu']
  },
  {
    name: 'Thái Bình',
    code: 'TB',
    districts: ['Thành phố Thái Bình', 'Huyện Đông Hưng', 'Huyện Hưng Hà', 'Huyện Kiến Xương', 'Huyện Quỳnh Phụ', 'Huyện Thái Thụy', 'Huyện Tiền Hải', 'Huyện Vũ Thư']
  },
  {
    name: 'Thái Nguyên',
    code: 'TNG',
    districts: ['Thành phố Thái Nguyên', 'Thành phố Sông Công', 'Thành phố Phổ Yên', 'Huyện Đại Từ', 'Huyện Định Hóa', 'Huyện Đồng Hỷ', 'Huyện Phú Bình', 'Huyện Phú Lương', 'Huyện Võ Nhai']
  },
  {
    name: 'Thanh Hóa',
    code: 'TH',
    districts: ['Thành phố Thanh Hóa', 'Thành phố Sầm Sơn', 'Thị xã Bỉm Sơn', 'Thị xã Nghi Sơn', 'Huyện Bá Thước', 'Huyện Cẩm Thủy', 'Huyện Đông Sơn', 'Huyện Hà Trung', 'Huyện Hậu Lộc', 'Huyện Hoằng Hóa', 'Huyện Lang Chánh', 'Huyện Mường Lát', 'Huyện Nga Sơn', 'Huyện Ngọc Lặc', 'Huyện Như Thanh', 'Huyện Như Xuân', 'Huyện Nông Cống', 'Huyện Quan Hóa', 'Huyện Quan Sơn', 'Huyện Quảng Xương', 'Huyện Thạch Thành', 'Huyện Thiệu Hóa', 'Huyện Thọ Xuân', 'Huyện Thường Xuân', 'Huyện Triệu Sơn', 'Huyện Vĩnh Lộc', 'Huyện Yên Định']
  },
  {
    name: 'Thừa Thiên Huế',
    code: 'TTH',
    districts: ['Thành phố Huế', 'Thị xã Hương Thủy', 'Thị xã Hương Trà', 'Huyện A Lưới', 'Huyện Nam Đông', 'Huyện Phong Điền', 'Huyện Phú Lộc', 'Huyện Phú Vang', 'Huyện Quảng Điền']
  },
  {
    name: 'Tiền Giang',
    code: 'TG',
    districts: ['Thành phố Mỹ Tho', 'Thị xã Gò Công', 'Thị xã Cai Lậy', 'Huyện Cái Bè', 'Huyện Cai Lậy', 'Huyện Châu Thành', 'Huyện Chợ Gạo', 'Huyện Gò Công Đông', 'Huyện Gò Công Tây', 'Huyện Tân Phú Đông', 'Huyện Tân Phước']
  },
  {
    name: 'Trà Vinh',
    code: 'TV',
    districts: ['Thành phố Trà Vinh', 'Thị xã Duyên Hải', 'Huyện Càng Long', 'Huyện Cầu Kè', 'Huyện Cầu Ngang', 'Huyện Châu Thành', 'Huyện Duyên Hải', 'Huyện Tiểu Cần', 'Huyện Trà Cú']
  },
  {
    name: 'Tuyên Quang',
    code: 'TQ',
    districts: ['Thành phố Tuyên Quang', 'Huyện Chiêm Hóa', 'Huyện Hàm Yên', 'Huyện Lâm Bình', 'Huyện Na Hang', 'Huyện Sơn Dương', 'Huyện Yên Sơn']
  },
  {
    name: 'Vĩnh Long',
    code: 'VL',
    districts: ['Thành phố Vĩnh Long', 'Thị xã Bình Minh', 'Huyện Bình Tân', 'Huyện Long Hồ', 'Huyện Mang Thít', 'Huyện Tam Bình', 'Huyện Trà Ôn', 'Huyện Vũng Liêm']
  },
  {
    name: 'Vĩnh Phúc',
    code: 'VP',
    districts: ['Thành phố Vĩnh Yên', 'Thành phố Phúc Yên', 'Huyện Bình Xuyên', 'Huyện Lập Thạch', 'Huyện Sông Lô', 'Huyện Tam Đảo', 'Huyện Tam Dương', 'Huyện Vĩnh Tường', 'Huyện Yên Lạc']
  },
  {
    name: 'Yên Bái',
    code: 'YB',
    districts: ['Thành phố Yên Bái', 'Thị xã Nghĩa Lộ', 'Huyện Lục Yên', 'Huyện Mù Căng Chải', 'Huyện Trạm Tấu', 'Huyện Trấn Yên', 'Huyện Văn Chấn', 'Huyện Văn Yên', 'Huyện Yên Bình']
  }
];

/**
 * Helper to normalize string for diacritics-insensitive matching
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Shipping fee calculation rules:
 * - Hà Nội + Hai Bà Trưng: 0đ (Freeship)
 * - Hà Nội + các quận/huyện khác: 5.000đ
 * - Tỉnh / Thành phố khác trên toàn quốc: 20.000đ
 */
export interface ShippingCalculationResult {
  fee: number;
  isFree: boolean;
  isPending?: boolean;
  tier: 'pending' | 'hbt_freeship' | 'hanoi_standard' | 'nationwide';
  title: string;
}

export function calculateShippingFee(province?: string, district?: string): ShippingCalculationResult {
  if (!province || !province.trim() || !district || !district.trim()) {
    return {
      fee: 0,
      isFree: false,
      isPending: true,
      tier: 'pending',
      title: 'Chưa chọn địa chỉ'
    };
  }

  const normProvince = normalizeText(province);
  const normDistrict = normalizeText(district);

  const isHanoi = normProvince.includes('ha noi') || normProvince.includes('hanoi') || normProvince === 'hn';

  if (isHanoi) {
    const isHaiBaTrung = normDistrict.includes('hai ba trung') || normDistrict.includes('haibatrung') || normDistrict.includes('hbt');

    if (isHaiBaTrung) {
      return {
        fee: 0,
        isFree: true,
        isPending: false,
        tier: 'hbt_freeship',
        title: '0đ'
      };
    }

    return {
      fee: 5000,
      isFree: false,
      isPending: false,
      tier: 'hanoi_standard',
      title: '5.000đ'
    };
  }

  return {
    fee: 20000,
    isFree: false,
    isPending: false,
    tier: 'nationwide',
    title: '20.000đ'
  };
}

export function getDistrictsByProvince(provinceName: string): string[] {
  if (!provinceName) return [];
  const found = VIETNAM_PROVINCES.find(
    (p) => p.name === provinceName || normalizeText(p.name) === normalizeText(provinceName)
  );
  return found ? found.districts : [];
}
