export interface ProvinceData {
  id: string;
  name: string;
  type: 'thanh-pho' | 'tinh';
  districts: {
    id: string;
    name: string;
    wards?: string[];
  }[];
}

export const VIETNAM_PROVINCES: ProvinceData[] = [
  {
    id: 'HN',
    name: 'Hà Nội',
    type: 'thanh-pho',
    districts: [
      { id: 'HN-BD', name: 'Quận Ba Đình', wards: ['Phường Cống Vị', 'Phường Điện Biên', 'Phường Đội Cấn', 'Phường Giảng Võ', 'Phường Kim Mã', 'Phường Liễu Giai', 'Phường Ngọc Hà', 'Phường Quán Thánh', 'Phường Thành Công', 'Phường Trúc Bạch'] },
      { id: 'HN-HK', name: 'Quận Hoàn Kiếm', wards: ['Phường Hàng Bạc', 'Phường Hàng Bài', 'Phường Hàng Bông', 'Phường Hàng Buồm', 'Phường Hàng Đào', 'Phường Hàng Gai', 'Phường Hàng Mã', 'Phường Tràng Tiền', 'Phường Lý Thái Tổ'] },
      { id: 'HN-DD', name: 'Quận Đống Đa', wards: ['Phường Cát Linh', 'Phường Hàng Bột', 'Phường Khâm Thiên', 'Phường Láng Hạ', 'Phường Láng Thượng', 'Phường Nam Đồng', 'Phường Ô Chợ Dừa', 'Phường Phương Mai', 'Phường Quang Trung', 'Phường Trung Tự', 'Phường Văn Miếu'] },
      { id: 'HN-CG', name: 'Quận Cầu Giấy', wards: ['Phường Dịch Vọng', 'Phường Dịch Vọng Hậu', 'Phường Mai Dịch', 'Phường Nghĩa Đô', 'Phường Nghĩa Tân', 'Phường Quan Hoa', 'Phường Trung Hòa', 'Phường Yên Hòa'] },
      { id: 'HN-TX', name: 'Quận Thanh Xuân', wards: ['Phường Hạ Đình', 'Phường Khương Đình', 'Phường Khương Mai', 'Phường Khương Trung', 'Phường Nhân Chính', 'Phường Phương Liệt', 'Phường Thanh Xuân Bắc', 'Phường Thanh Xuân Nam', 'Phường Thanh Xuân Trung'] },
      { id: 'HN-HBT', name: 'Quận Hai Bà Trưng', wards: ['Phường Bạch Đằng', 'Phường Bách Khoa', 'Phường Bạch Mai', 'Phường Cầu Dền', 'Phường Đống Mác', 'Phường Đồng Nhân', 'Phường Lê Đại Hành', 'Phường Minh Khai', 'Phường Trương Định', 'Phường Vĩnh Tuy'] },
      { id: 'HN-TH', name: 'Quận Tây Hồ', wards: ['Phường Bưởi', 'Phường Nhật Tân', 'Phường Phú Thượng', 'Phường Quảng An', 'Phường Thụy Khuê', 'Phường Tứ Liên', 'Phường Xuân La', 'Phường Yên Phụ'] },
      { id: 'HN-HM', name: 'Quận Hoàng Mai', wards: ['Phường Đại Kim', 'Phường Định Công', 'Phường Giáp Bát', 'Phường Hoàng Liệt', 'Phường Hoàng Văn Thụ', 'Phường Lĩnh Nam', 'Phường Mai Động', 'Phường Tân Mai', 'Phường Thịnh Liệt', 'Phường Vĩnh Hưng', 'Phường Yên Sở'] },
      { id: 'HN-LB', name: 'Quận Long Biên', wards: ['Phường Bồ Đề', 'Phường Cự Khối', 'Phường Đức Giang', 'Phường Gia Thụy', 'Phường Giang Biên', 'Phường Long Biên', 'Phường Ngọc Lâm', 'Phường Ngọc Thụy', 'Phường Phúc Đồng', 'Phường Phúc Lợi', 'Phường Sài Đồng', 'Phường Thạch Bàn', 'Phường Thượng Thanh', 'Phường Việt Hưng'] },
      { id: 'HN-NTL', name: 'Quận Nam Từ Liêm', wards: ['Phường Cầu Diễn', 'Phường Đại Mỗ', 'Phường Mễ Trì', 'Phường Mỹ Đình 1', 'Phường Mỹ Đình 2', 'Phường Phú Đô', 'Phường Tây Mỗ', 'Phường Trung Văn', 'Phường Xuân Phương'] },
      { id: 'HN-BTL', name: 'Quận Bắc Từ Liêm', wards: ['Phường Cổ Nhuế 1', 'Phường Cổ Nhuế 2', 'Phường Đức Thắng', 'Phường Đông Ngạc', 'Phường Minh Khai', 'Phường Phú Diễn', 'Phường Phúc Diễn', 'Phường Tây Tựu', 'Phường Thượng Cát', 'Phường Thụy Phương', 'Phường Xuân Đỉnh', 'Phường Xuân Tảo'] },
      { id: 'HN-HD', name: 'Quận Hà Đông', wards: ['Phường Biên Giang', 'Phường Đồng Mai', 'Phường Dương Nội', 'Phường Hà Cầu', 'Phường Kiến Hưng', 'Phường La Khê', 'Phường Mộ Lao', 'Phường Nguyễn Trãi', 'Phường Phú La', 'Phường Phú Lãm', 'Phường Phú Lương', 'Phường Phúc La', 'Phường Quang Trung', 'Phường Vạn Phúc', 'Phường Văn Quán', 'Phường Yên Nghĩa', 'Phường Yết Kiêu'] },
      { id: 'HN-ST', name: 'Thị xã Sơn Tây', wards: ['Phường Lê Lợi', 'Phường Ngô Quyền', 'Phường Phú Thịnh', 'Phường Quang Trung', 'Phường Sơn Lộc', 'Phường Trung Hưng', 'Phường Trung Sơn Trầm', 'Phường Xuân Khanh'] },
      { id: 'HN-BAVI', name: 'Huyện Ba Vì', wards: ['Thị trấn Tây Đằng', 'Xã Ba Trại', 'Xã Cam Thượng', 'Xã Chu Minh', 'Xã Cổ Đô', 'Xã Đồng Thái', 'Xã Khánh Thượng', 'Xã Minh Quang', 'Xã Phong Vân', 'Xã Phú Cường', 'Xã Phú Đông', 'Xã Phú Phương', 'Xã Phú Châu', 'Xã Sơn Đà', 'Xã Tân Lĩnh', 'Xã Thụy An', 'Xã Tiên Phong', 'Xã Tòng Bạt', 'Xã Vạn Thắng', 'Xã Vân Hòa', 'Xã Vật Lại', 'Xã Yên Bài'] },
      { id: 'HN-CH', name: 'Huyện Chương Mỹ', wards: ['Thị trấn Chúc Sơn', 'Thị trấn Xuân Mai', 'Xã Đại Yên', 'Xã Đông Phương Yên', 'Xã Đông Sơn', 'Xã Đồng Lạc', 'Xã Đồng Phú', 'Xã Hòa Chính', 'Xã Hoàng Diệu', 'Xã Hoàng Văn Thụ', 'Xã Hồng Phong', 'Xã Hợp Đồng', 'Xã Hữu Văn', 'Xã Lam Điền', 'Xã Mỹ Lương', 'Xã Nam Phương Tiến', 'Xã Ngọc Hòa', 'Xã Phú Nam An', 'Xã Phú Nghĩa', 'Xã Phụng Châu', 'Xã Quảng Bị', 'Xã Tân Tiến', 'Xã Tiên Phương', 'Xã Tốt Động', 'Xã Thanh Bình', 'Xã Thủy Xuân Tiên', 'Xã Thụy Hương', 'Xã Thượng Vực', 'Xã Trần Phú', 'Xã Trung Hòa', 'Xã Trường Yên', 'Xã Văn Võ'] },
      { id: 'HN-DP', name: 'Huyện Đan Phượng', wards: ['Thị trấn Phùng', 'Xã Đan Phượng', 'Xã Đồng Tháp', 'Xã Hạ Mỗ', 'Xã Hồng Hà', 'Xã Liên Hà', 'Xã Liên Hồng', 'Xã Liên Trung', 'Xã Phương Đình', 'Xã Song Phượng', 'Xã Tân Hội', 'Xã Tân Lập', 'Xã Thọ An', 'Xã Thọ Xuân', 'Xã Thượng Mỗ', 'Xã Trung Châu'] },
      { id: 'HN-DA', name: 'Huyện Đông Anh', wards: ['Thị trấn Đông Anh', 'Xã Bắc Hồng', 'Xã Cổ Loa', 'Xã Dục Tú', 'Xã Đại Mạch', 'Xã Đông Hội', 'Xã Hải Bối', 'Xã Kim Chung', 'Xã Kim Nỗ', 'Xã Liên Hà', 'Xã Mai Lâm', 'Xã Nam Hồng', 'Xã Nguyên Khê', 'Xã Tàm Xá', 'Xã Thụy Lâm', 'Xã Tiên Dương', 'Xã Uy Nỗ', 'Xã Vân Hà', 'Xã Vân Nội', 'Xã Việt Hùng', 'Xã Vĩnh Ngọc', 'Xã Võng La', 'Xã Xuân Canh', 'Xã Xuân Nộn'] },
      { id: 'HN-GL', name: 'Huyện Gia Lâm', wards: ['Thị trấn Trâu Quỳ', 'Thị trấn Yên Viên', 'Xã Bát Tràng', 'Xã Cổ Bi', 'Xã Đa Tốn', 'Xã Đặng Xá', 'Xã Đình Xuyên', 'Xã Đông Dư', 'Xã Dương Hà', 'Xã Dương Quang', 'Xã Dương Xá', 'Xã Kiêu Kỵ', 'Xã Kim Lan', 'Xã Kim Sơn', 'Xã Lệ Chi', 'Xã Ninh Hiệp', 'Xã Phù Đổng', 'Xã Phú Thị', 'Xã Trung Mầu', 'Xã Văn Đức', 'Xã Yên Thường', 'Xã Yên Viên'] },
      { id: 'HN-HOAIDUC', name: 'Huyện Hoài Đức', wards: ['Thị trấn Trạm Trôi', 'Xã An Khánh', 'Xã An Thượng', 'Xã Cát Quế', 'Xã Đắc Sở', 'Xã Di Trạch', 'Xã Đông La', 'Xã Đức Giang', 'Xã Đức Thượng', 'Xã Kim Chung', 'Xã La Phù', 'Xã Lại Yên', 'Xã Minh Khai', 'Xã Song Phương', 'Xã Sơn Đồng', 'Xã Tiền Yên', 'Xã Vân Canh', 'Xã Vân Côn', 'Xã Yên Sở'] },
      { id: 'HN-ME', name: 'Huyện Mê Linh', wards: ['Thị trấn Chi Đông', 'Thị trấn Quang Minh', 'Xã Chu Phan', 'Xã Đại Thịnh', 'Xã Hoàng Kim', 'Xã Kim Hoa', 'Xã Liên Mạc', 'Xã Mê Linh', 'Xã Tam Đồng', 'Xã Thạch Đà', 'Xã Thanh Lâm', 'Xã Tiền Phong', 'Xã Tiến Thắng', 'Xã Tự Lập', 'Xã Tráng Việt', 'Xã Văn Khê', 'Xã Vạn Yên'] },
      { id: 'HN-SOCSON', name: 'Huyện Sóc Sơn', wards: ['Thị trấn Sóc Sơn', 'Xã Bắc Phú', 'Xã Bắc Sơn', 'Xã Đông Xuân', 'Xã Đức Hòa', 'Xã Hiền Ninh', 'Xã Hồng Kỳ', 'Xã Kim Lũ', 'Xã Mai Đình', 'Xã Minh Phú', 'Xã Minh Trí', 'Xã Nam Sơn', 'Xã Phú Cường', 'Xã Phù Linh', 'Xã Phù Lỗ', 'Xã Phú Minh', 'Xã Quang Tiến', 'Xã Tân Dân', 'Xã Tân Hưng', 'Xã Tân Minh', 'Xã Thanh Xuân', 'Xã Tiên Dược', 'Xã Trung Giã', 'Xã Việt Long', 'Xã Xuân Giang', 'Xã Xuân Thu'] },
      { id: 'HN-THANHTRI', name: 'Huyện Thanh Trì', wards: ['Thị trấn Văn Điển', 'Xã Đại Áng', 'Xã Đông Mỹ', 'Xã Duyên Hà', 'Xã Hữu Hòa', 'Xã Liên Ninh', 'Xã Ngọc Hồi', 'Xã Ngũ Hiệp', 'Xã Tả Thanh Oai', 'Xã Tam Hiệp', 'Xã Tân Triều', 'Xã Thanh Liệt', 'Xã Tứ Hiệp', 'Xã Vạn Phúc', 'Xã Vĩnh Quỳnh', 'Xã Yên Mỹ'] },
      { id: 'HN-THACHTHAT', name: 'Huyện Thạch Thất', wards: ['Thị trấn Liên Quan', 'Xã Bình Phú', 'Xã Bình Yên', 'Xã Cẩm Yên', 'Xã Cần Kiệm', 'Xã Canh Nậu', 'Xã Chàng Sơn', 'Xã Đại Đồng', 'Xã Dị Nậu', 'Xã Đồng Trúc', 'Xã Hạ Bằng', 'Xã Hương Ngải', 'Xã Hữu Bằng', 'Xã Kim Quan', 'Xã Lại Thượng', 'Xã Phú Kim', 'Xã Phùng Xá', 'Xã Tân Xã', 'Xã Thạch Hòa', 'Xã Thạch Xá', 'Xã Tiến Xuân', 'Xã Yên Bình', 'Xã Yên Trung'] },
      { id: 'HN-QUOCOAI', name: 'Huyện Quốc Oai', wards: ['Thị trấn Quốc Oai', 'Xã Cấn Hữu', 'Xã Cộng Hòa', 'Xã Đại Thành', 'Xã Đồng Quang', 'Xã Đông Yên', 'Xã Hòa Thạch', 'Xã Liệp Tuyết', 'Xã Nghĩa Hương', 'Xã Ngọc Liệp', 'Xã Ngọc Mỹ', 'Xã Phú Cát', 'Xã Phú Mãn', 'Xã Phượng Cách', 'Xã Sài Sơn', 'Xã Tân Hòa', 'Xã Tân Phú', 'Xã Thạch Thán', 'Xã Tuyết Nghĩa', 'Xã Yên Sơn'] },
      { id: 'HN-THUONGTIN', name: 'Huyện Thường Tín', wards: ['Thị trấn Thường Tín', 'Xã Dũng Tiến', 'Xã Duyên Thái', 'Xã Hà Hồi', 'Xã Hiền Giang', 'Xã Hòa Bình', 'Xã Khánh Hà', 'Xã Hồng Vân', 'Xã Liên Phương', 'Xã Minh Cường', 'Xã Nghiêm Xuyên', 'Xã Nguyễn Trãi', 'Xã Nhị Khê', 'Xã Ninh Sở', 'Xã Quất Động', 'Xã Tân Minh', 'Xã Thắng Lợi', 'Xã Thống Nhất', 'Xã Thư Phú', 'Xã Tiền Phong', 'Xã Tô Hiệu', 'Xã Tự Nhiên', 'Xã Vạn Điểm', 'Xã Văn Bình', 'Xã Văn Phú', 'Xã Văn Tự', 'Xã Vân Tảo'] },
      { id: 'HN-PHUXUYEN', name: 'Huyện Phú Xuyên', wards: ['Thị trấn Phú Xuyên', 'Thị trấn Phú Minh', 'Xã Bạch Hạ', 'Xã Châu Can', 'Xã Chuyên Mỹ', 'Xã Đại Thắng', 'Xã Đại Xuyên', 'Xã Hoàng Long', 'Xã Hồng Minh', 'Xã Hồng Thái', 'Xã Khai Thái', 'Xã Nam Phong', 'Xã Nam Triều', 'Xã Phú Túc', 'Xã Phú Yên', 'Xã Phúc Tiến', 'Xã Phượng Dực', 'Xã Quang Lãng', 'Xã Quang Trung', 'Xã Sơn Hà', 'Xã Tân Dân', 'Xã Thụy Phú', 'Xã Tri Thủy', 'Xã Tri Trung', 'Xã Văn Hoàng', 'Xã Vân Từ'] },
      { id: 'HN-THANHOAI', name: 'Huyện Thanh Oai', wards: ['Thị trấn Kim Bài', 'Xã Bích Hòa', 'Xã Bình Minh', 'Xã Cao Dương', 'Xã Cao Viên', 'Xã Cự Khê', 'Xã Dân Hòa', 'Xã Đỗ Động', 'Xã Hồng Dương', 'Xã Kim An', 'Xã Kim Thư', 'Xã Liên Châu', 'Xã Mỹ Hưng', 'Xã Phương Trung', 'Xã Tam Hưng', 'Xã Tân Ước', 'Xã Thanh Cao', 'Xã Thanh Mai', 'Xã Thanh Thùy', 'Xã Thanh Văn', 'Xã Xuân Dương'] },
      { id: 'HN-UNGHOA', name: 'Huyện Ứng Hòa', wards: ['Thị trấn Vân Đình', 'Xã Cao Thành', 'Xã Đại Cường', 'Xã Đại Hùng', 'Xã Đội Bình', 'Xã Đông Lỗ', 'Xã Đồng Tân', 'Xã Đồng Tiến', 'Xã Hoa Sơn', 'Xã Hòa Lâm', 'Xã Hòa Nam', 'Xã Hòa Phú', 'Xã Hòa Xá', 'Xã Hồng Quang', 'Xã Kim Đường', 'Xã Liên Bạt', 'Xã Lưu Hoàng', 'Xã Minh Đức', 'Xã Phù Lưu', 'Xã Phương Tú', 'Xã Quảng Phú Cầu', 'Xã Tảo Dương Văn', 'Xã Trầm Lộng', 'Xã Trung Tú', 'Xã Trường Thịnh', 'Xã Vạn Thái', 'Xã Viên An', 'Xã Viên Nội'] },
      { id: 'HN-MYDUC', name: 'Huyện Mỹ Đức', wards: ['Thị trấn Đại Nghĩa', 'Xã An Mỹ', 'Xã An Phú', 'Xã An Tiến', 'Xã Bột Xuyên', 'Xã Đại Hưng', 'Xã Đốc Tín', 'Xã Đồng Tâm', 'Xã Hồng Sơn', 'Xã Hợp Thanh', 'Xã Hợp Tiến', 'Xã Hùng Tiến', 'Xã Hương Sơn', 'Xã Lê Thanh', 'Xã Mỹ Thành', 'Xã Phù Lưu Tế', 'Xã Phúc Lâm', 'Xã Phùng Xá', 'Xã Thượng Lâm', 'Xã Tuy Lai', 'Xã Vạn Kim', 'Xã Xuy Xá'] }
    ]
  },
  {
    id: 'HCM',
    name: 'TP. Hồ Chí Minh',
    type: 'thanh-pho',
    districts: [
      { id: 'HCM-Q1', name: 'Quận 1', wards: ['Phường Bến Nghé', 'Phường Bến Thành', 'Phường Cầu Kho', 'Phường Cầu Ông Lãnh', 'Phường Cô Giang', 'Phường Đa Kao', 'Phường Nguyễn Cư Trinh', 'Phường Nguyễn Thái Bình', 'Phường Phạm Ngũ Lão', 'Phường Tân Định'] },
      { id: 'HCM-Q3', name: 'Quận 3', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường Võ Thị Sáu'] },
      { id: 'HCM-Q4', name: 'Quận 4', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 6', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16', 'Phường 18'] },
      { id: 'HCM-Q5', name: 'Quận 5', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'] },
      { id: 'HCM-Q6', name: 'Quận 6', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14'] },
      { id: 'HCM-Q7', name: 'Quận 7', wards: ['Phường Bình Thuận', 'Phường Phú Mỹ', 'Phường Phú Thuận', 'Phường Tân Hưng', 'Phường Tân Kiểng', 'Phường Tân Phong', 'Phường Tân Phú', 'Phường Tân Quy', 'Phường Tân Thuận Đông', 'Phường Tân Thuận Tây'] },
      { id: 'HCM-Q8', name: 'Quận 8', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16'] },
      { id: 'HCM-Q10', name: 'Quận 10', wards: ['Phường 1', 'Phường 2', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15'] },
      { id: 'HCM-Q11', name: 'Quận 11', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16'] },
      { id: 'HCM-Q12', name: 'Quận 12', wards: ['Phường An Phú Đông', 'Phường Đông Hưng Thuận', 'Phường Hiệp Thành', 'Phường Tân Chánh Hiệp', 'Phường Tân Hưng Thuận', 'Phường Tân Thới Hiệp', 'Phường Tân Thới Nhất', 'Phường Thạnh Lộc', 'Phường Thạnh Xuân', 'Phường Thới An', 'Phường Trung Mỹ Tây'] },
      { id: 'HCM-BT', name: 'Quận Bình Thạnh', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 17', 'Phường 19', 'Phường 21', 'Phường 22', 'Phường 24', 'Phường 25', 'Phường 26', 'Phường 27', 'Phường 28'] },
      { id: 'HCM-GV', name: 'Quận Gò Vấp', wards: ['Phường 1', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15', 'Phường 16', 'Phường 17'] },
      { id: 'HCM-PN', name: 'Quận Phú Nhuận', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 13', 'Phường 15', 'Phường 17'] },
      { id: 'HCM-TB', name: 'Quận Tân Bình', wards: ['Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5', 'Phường 6', 'Phường 7', 'Phường 8', 'Phường 9', 'Phường 10', 'Phường 11', 'Phường 12', 'Phường 13', 'Phường 14', 'Phường 15'] },
      { id: 'HCM-TP', name: 'Quận Tân Phú', wards: ['Phường Hiệp Tân', 'Phường Hòa Thạnh', 'Phường Phú Thạnh', 'Phường Phú Thọ Hòa', 'Phường Phú Trung', 'Phường Sơn Kỳ', 'Phường Tân Quý', 'Phường Tân Sơn Nhì', 'Phường Tân Thành', 'Phường Tân Thới Hòa', 'Phường Tây Thạnh'] },
      { id: 'HCM-BINTAN', name: 'Quận Bình Tân', wards: ['Phường An Lạc', 'Phường An Lạc A', 'Phường Bình Hưng Hòa', 'Phường Bình Hưng Hòa A', 'Phường Bình Hưng Hòa B', 'Phường Bình Trị Đông', 'Phường Bình Trị Đông A', 'Phường Bình Trị Đông B', 'Phường Tân Tạo', 'Phường Tân Tạo A'] },
      { id: 'HCM-TD', name: 'TP. Thủ Đức', wards: ['Phường An Khánh', 'Phường An Lợi Đông', 'Phường An Phú', 'Phường Bình Chiểu', 'Phường Bình Thọ', 'Phường Cát Lái', 'Phường Hiệp Bình Chánh', 'Phường Hiệp Bình Phước', 'Phường Hiệp Phú', 'Phường Linh Chiểu', 'Phường Linh Đông', 'Phường Linh Tây', 'Phường Linh Trung', 'Phường Linh Xuân', 'Phường Long Bình', 'Phường Long Phước', 'Phường Long Thạnh Mỹ', 'Phường Long Trường', 'Phường Phú Hữu', 'Phường Phước Bình', 'Phường Phước Long A', 'Phường Phước Long B', 'Phường Tam Bình', 'Phường Tam Phú', 'Phường Tân Phú', 'Phường Tăng Nhơn Phú A', 'Phường Tăng Nhơn Phú B', 'Phường Thạnh Mỹ Lợi', 'Phường Thảo Điền', 'Phường Thủ Thiêm', 'Phường Trường Thạnh', 'Phường Trường Thọ'] },
      { id: 'HCM-BC', name: 'Huyện Bình Chánh', wards: ['Thị trấn Tân Túc', 'Xã An Phú Tây', 'Xã Bình Chánh', 'Xã Bình Hưng', 'Xã Bình Lợi', 'Xã Đa Phước', 'Xã Hưng Long', 'Xã Lê Minh Xuân', 'Xã Phạm Văn Hai', 'Xã Phong Phú', 'Xã Quy Đức', 'Xã Tân Kiên', 'Xã Tân Nhựt', 'Xã Tân Quý Tây', 'Xã Vĩnh Lộc A', 'Xã Vĩnh Lộc B'] },
      { id: 'HCM-CC', name: 'Huyện Củ Chi', wards: ['Thị trấn Củ Chi', 'Xã An Nhơn Tây', 'Xã An Phú', 'Xã Bình Mỹ', 'Xã Cây Trôm', 'Xã Hòa Phú', 'Xã Nhuận Đức', 'Xã Phạm Văn Cội', 'Xã Phú Hòa Đông', 'Xã Phú Mỹ Hưng', 'Xã Phước Hiệp', 'Xã Phước Thạnh', 'Xã Phước Vĩnh An', 'Xã Tân An Hội', 'Xã Tân Định', 'Xã Tân Phú Trung', 'Xã Tân Thạnh Đông', 'Xã Tân Thạnh Tây', 'Xã Tân Thông Hội', 'Xã Thái Mỹ', 'Xã Trung An', 'Xã Trung Lập Hạ', 'Xã Trung Lập Thượng'] },
      { id: 'HCM-HM', name: 'Huyện Hóc Môn', wards: ['Thị trấn Hóc Môn', 'Xã Bà Điểm', 'Xã Đông Thạnh', 'Xã Nhị Bình', 'Xã Tân Hiệp', 'Xã Tân Thới Nhì', 'Xã Tân Xuân', 'Xã Thới Tam Thôn', 'Xã Trung Chánh', 'Xã Xuân Thới Đông', 'Xã Xuân Thới Sơn', 'Xã Xuân Thới Thượng'] },
      { id: 'HCM-NB', name: 'Huyện Nhà Bè', wards: ['Thị trấn Nhà Bè', 'Xã Hiệp Phước', 'Xã Long Thới', 'Xã Nhơn Đức', 'Xã Phú Xuân', 'Xã Phước Kiển', 'Xã Phước Lộc'] },
      { id: 'HCM-CG', name: 'Huyện Cần Giờ', wards: ['Thị trấn Cần Thạnh', 'Xã An Thới Đông', 'Xã Bình Khánh', 'Xã Long Hòa', 'Xã Lý Nhơn', 'Xã Tam Thôn Hiệp', 'Xã Thạnh An'] }
    ]
  },
  {
    id: 'DN',
    name: 'Đà Nẵng',
    type: 'thanh-pho',
    districts: [
      { id: 'DN-HC', name: 'Quận Hải Châu', wards: ['Phường Hải Châu 1', 'Phường Hải Châu 2', 'Phường Thạch Thang', 'Phường Thanh Bình', 'Phường Thuận Phước', 'Phường Hòa Thuận Tây', 'Phường Hòa Thuận Đông', 'Phường Nam Dương', 'Phường Phước Ninh', 'Phường Bình Thuận', 'Phường Bình Hiên', 'Phường Hòa Cường Bắc', 'Phường Hòa Cường Nam'] },
      { id: 'DN-TK', name: 'Quận Thanh Khê', wards: ['Phường Tam Thuận', 'Phường Thanh Khê Tây', 'Phường Thanh Khê Đông', 'Phường Xuân Hà', 'Phường Tân Chính', 'Phường Chính Gián', 'Phường Vĩnh Trung', 'Phường Thạc Gián', 'Phường An Khê', 'Phường Hòa Khê'] },
      { id: 'DN-ST', name: 'Quận Sơn Trà', wards: ['Phường An Hải Bắc', 'Phường An Hải Đông', 'Phường An Hải Tây', 'Phường Mân Thái', 'Phường Nại Hiên Đông', 'Phường Phước Mỹ', 'Phường Thọ Quang'] },
      { id: 'DN-NHS', name: 'Quận Ngũ Hành Sơn', wards: ['Phường Hòa Hải', 'Phường Hòa Quý', 'Phường Khuê Mỹ', 'Phường Mỹ An'] },
      { id: 'DN-LC', name: 'Quận Liên Chiểu', wards: ['Phường Hòa Hiệp Bắc', 'Phường Hòa Hiệp Nam', 'Phường Hòa Khánh Bắc', 'Phường Hòa Khánh Nam', 'Phường Hòa Minh'] },
      { id: 'DN-CL', name: 'Quận Cẩm Lệ', wards: ['Phường Hòa An', 'Phường Hòa Phát', 'Phường Hòa Thọ Đông', 'Phường Hòa Thọ Tây', 'Phường Hòa Xuân', 'Phường Khuê Trung'] },
      { id: 'DN-HV', name: 'Huyện Hòa Vang', wards: ['Xã Hòa Bắc', 'Xã Hòa Châu', 'Xã Hòa Khương', 'Xã Hòa Liên', 'Xã Hòa Nhơn', 'Xã Hòa Ninh', 'Xã Hòa Phong', 'Xã Hòa Phú', 'Xã Hòa Phước', 'Xã Hòa Sơn', 'Xã Hòa Tiến'] }
    ]
  },
  {
    id: 'HP',
    name: 'Hải Phòng',
    type: 'thanh-pho',
    districts: [
      { id: 'HP-HB', name: 'Quận Hồng Bàng' },
      { id: 'HP-NQ', name: 'Quận Ngô Quyền' },
      { id: 'HP-LC', name: 'Quận Lê Chân' },
      { id: 'HP-HA', name: 'Quận Hải An' },
      { id: 'HP-KA', name: 'Quận Kiến An' },
      { id: 'HP-DS', name: 'Quận Đồ Sơn' },
      { id: 'HP-DK', name: 'Quận Dương Kinh' },
      { id: 'HP-TN', name: 'Huyện Thủy Nguyên' },
      { id: 'HP-AD', name: 'Huyện An Dương' },
      { id: 'HP-AL', name: 'Huyện An Lão' },
      { id: 'HP-KT', name: 'Huyện Kiến Thụy' },
      { id: 'HP-TH', name: 'Huyện Tiên Lãng' },
      { id: 'HP-VB', name: 'Huyện Vĩnh Bảo' },
      { id: 'HP-CB', name: 'Huyện Cát Hải' }
    ]
  },
  {
    id: 'CT',
    name: 'Cần Thơ',
    type: 'thanh-pho',
    districts: [
      { id: 'CT-NK', name: 'Quận Ninh Kiều' },
      { id: 'CT-BT', name: 'Quận Bình Thủy' },
      { id: 'CT-CR', name: 'Quận Cái Răng' },
      { id: 'CT-OM', name: 'Quận Ô Môn' },
      { id: 'CT-TN', name: 'Quận Thốt Nốt' },
      { id: 'CT-PD', name: 'Huyện Phong Điền' },
      { id: 'CT-CL', name: 'Huyện Cờ Đỏ' },
      { id: 'CT-TD', name: 'Huyện Thới Lai' },
      { id: 'CT-VT', name: 'Huyện Vĩnh Thạnh' }
    ]
  },
  {
    id: 'BD',
    name: 'Bình Dương',
    type: 'tinh',
    districts: [
      { id: 'BD-TDM', name: 'TP. Thủ Dầu Một' },
      { id: 'BD-TA', name: 'TP. Thuận An' },
      { id: 'BD-DA', name: 'TP. Dĩ An' },
      { id: 'BD-TU', name: 'TP. Tân Uyên' },
      { id: 'BD-BC', name: 'TP. Bến Cát' },
      { id: 'BD-BG', name: 'Huyện Bàu Bàng' },
      { id: 'BD-BG2', name: 'Huyện Bắc Tân Uyên' },
      { id: 'BD-DT', name: 'Huyện Dầu Tiếng' },
      { id: 'BD-PG', name: 'Huyện Phú Giáo' }
    ]
  },
  {
    id: 'DON',
    name: 'Đồng Nai',
    type: 'tinh',
    districts: [
      { id: 'DON-BH', name: 'TP. Biên Hòa' },
      { id: 'DON-LK', name: 'TP. Long Khánh' },
      { id: 'DON-LT', name: 'Huyện Long Thành' },
      { id: 'DON-NT', name: 'Huyện Nhơn Trạch' },
      { id: 'DON-TB', name: 'Huyện Trảng Bom' },
      { id: 'DON-TN', name: 'Huyện Thống Nhất' },
      { id: 'DON-VC', name: 'Huyện Vĩnh Cửu' },
      { id: 'DON-CL', name: 'Huyện Cẩm Mỹ' },
      { id: 'DON-XN', name: 'Huyện Xuân Lộc' },
      { id: 'DON-DQ', name: 'Huyện Định Quán' },
      { id: 'DON-TL', name: 'Huyện Tân Phú' }
    ]
  },
  {
    id: 'QN',
    name: 'Quảng Ninh',
    type: 'tinh',
    districts: [
      { id: 'QN-HL', name: 'TP. Hạ Long' },
      { id: 'QN-CP', name: 'TP. Cẩm Phả' },
      { id: 'QN-UB', name: 'TP. Uông Bí' },
      { id: 'QN-MC', name: 'TP. Móng Cái' },
      { id: 'QN-QY', name: 'Thị xã Quảng Yên' },
      { id: 'QN-DT', name: 'Thị xã Đông Triều' },
      { id: 'QN-VD', name: 'Huyện Vân Đồn' },
      { id: 'QN-CT', name: 'Huyện Cô Tô' }
    ]
  },
  {
    id: 'HUE',
    name: 'Thừa Thiên Huế',
    type: 'tinh',
    districts: [
      { id: 'HUE-TP', name: 'TP. Huế' },
      { id: 'HUE-HT', name: 'Thị xã Hương Thủy' },
      { id: 'HUE-HT2', name: 'Thị xã Hương Trà' },
      { id: 'HUE-PD', name: 'Huyện Phong Điền' },
      { id: 'HUE-QD', name: 'Huyện Quảng Điền' },
      { id: 'HUE-PL', name: 'Huyện Phú Lộc' },
      { id: 'HUE-PV', name: 'Huyện Phú Vang' }
    ]
  },
  {
    id: 'KH',
    name: 'Khánh Hòa',
    type: 'tinh',
    districts: [
      { id: 'KH-NT', name: 'TP. Nha Trang' },
      { id: 'KH-CR', name: 'TP. Cam Ranh' },
      { id: 'KH-NL', name: 'Thị xã Ninh Hòa' },
      { id: 'KH-VD', name: 'Huyện Vạn Ninh' },
      { id: 'KH-DK', name: 'Huyện Diên Khánh' },
      { id: 'KH-CL', name: 'Huyện Cam Lâm' }
    ]
  },
  // All other provinces
  { id: 'AG', name: 'An Giang', type: 'tinh', districts: [{ id: 'AG-LX', name: 'TP. Long Xuyên' }, { id: 'AG-CD', name: 'TP. Châu Đốc' }, { id: 'AG-TB', name: 'Thị xã Tân Châu' }, { id: 'AG-TC', name: 'Thị xã Tịnh Biên' }] },
  { id: 'BRVT', name: 'Bà Rịa - Vũng Tàu', type: 'tinh', districts: [{ id: 'BR-VT', name: 'TP. Vũng Tàu' }, { id: 'BR-BR', name: 'TP. Bà Rịa' }, { id: 'BR-PM', name: 'Thị xã Phú Mỹ' }, { id: 'BR-CD', name: 'Huyện Côn Đảo' }] },
  { id: 'BG', name: 'Bắc Giang', type: 'tinh', districts: [{ id: 'BG-TP', name: 'TP. Bắc Giang' }, { id: 'BG-VY', name: 'Thị xã Việt Yên' }] },
  { id: 'BK', name: 'Bắc Kạn', type: 'tinh', districts: [{ id: 'BK-TP', name: 'TP. Bắc Kạn' }] },
  { id: 'BL', name: 'Bạc Liêu', type: 'tinh', districts: [{ id: 'BL-TP', name: 'TP. Bạc Liêu' }, { id: 'BL-GR', name: 'Thị xã Giá Rai' }] },
  { id: 'BN', name: 'Bắc Ninh', type: 'tinh', districts: [{ id: 'BN-TP', name: 'TP. Bắc Ninh' }, { id: 'BN-TS', name: 'TP. Từ Sơn' }, { id: 'BN-QV', name: 'Thị xã Quế Võ' }, { id: 'BN-TT', name: 'Thị xã Thuận Thành' }] },
  { id: 'BT', name: 'Bến Tre', type: 'tinh', districts: [{ id: 'BT-TP', name: 'TP. Bến Tre' }] },
  { id: 'BDH', name: 'Bình Định', type: 'tinh', districts: [{ id: 'BDH-QN', name: 'TP. Quy Nhơn' }, { id: 'BDH-AN', name: 'Thị xã An Nhơn' }, { id: 'BDH-HN', name: 'Thị xã Hoài Nhơn' }] },
  { id: 'BP', name: 'Bình Phước', type: 'tinh', districts: [{ id: 'BP-DX', name: 'TP. Đồng Xoài' }, { id: 'BP-PL', name: 'Thị xã Phước Long' }, { id: 'BP-BL', name: 'Thị xã Bình Long' }, { id: 'BP-CT', name: 'Thị xã Chơn Thành' }] },
  { id: 'BTH', name: 'Bình Thuận', type: 'tinh', districts: [{ id: 'BTH-PT', name: 'TP. Phan Thiết' }, { id: 'BTH-LG', name: 'Thị xã La Gi' }] },
  { id: 'CM', name: 'Cà Mau', type: 'tinh', districts: [{ id: 'CM-TP', name: 'TP. Cà Mau' }] },
  { id: 'CB', name: 'Cao Bằng', type: 'tinh', districts: [{ id: 'CB-TP', name: 'TP. Cao Bằng' }] },
  { id: 'DL', name: 'Đắk Lắk', type: 'tinh', districts: [{ id: 'DL-BMT', name: 'TP. Buôn Ma Thuột' }, { id: 'DL-BH', name: 'Thị xã Buôn Hồ' }] },
  { id: 'DNONG', name: 'Đắk Nông', type: 'tinh', districts: [{ id: 'DN-GN', name: 'TP. Gia Nghĩa' }] },
  { id: 'DB', name: 'Điện Biên', type: 'tinh', districts: [{ id: 'DB-TP', name: 'TP. Điện Biên Phủ' }, { id: 'DB-ML', name: 'Thị xã Mường Lay' }] },
  { id: 'DT', name: 'Đồng Tháp', type: 'tinh', districts: [{ id: 'DT-CL', name: 'TP. Cao Lãnh' }, { id: 'DT-SD', name: 'TP. Sa Đéc' }, { id: 'DT-HN', name: 'TP. Hồng Ngự' }] },
  { id: 'GL', name: 'Gia Lai', type: 'tinh', districts: [{ id: 'GL-PL', name: 'TP. Pleiku' }, { id: 'GL-AC', name: 'Thị xã An Khê' }, { id: 'GL-AP', name: 'Thị xã Ayun Pa' }] },
  { id: 'HG', name: 'Hà Giang', type: 'tinh', districts: [{ id: 'HG-TP', name: 'TP. Hà Giang' }] },
  { id: 'HNAM', name: 'Hà Nam', type: 'tinh', districts: [{ id: 'HNAM-PL', name: 'TP. Phủ Lý' }, { id: 'HNAM-DT', name: 'Thị xã Duy Tiên' }] },
  { id: 'HT', name: 'Hà Tĩnh', type: 'tinh', districts: [{ id: 'HT-TP', name: 'TP. Hà Tĩnh' }, { id: 'HT-HL', name: 'Thị xã Hồng Lĩnh' }, { id: 'HT-KA', name: 'Thị xã Kỳ Anh' }] },
  { id: 'HD', name: 'Hải Dương', type: 'tinh', districts: [{ id: 'HD-TP', name: 'TP. Hải Dương' }, { id: 'HD-CL', name: 'TP. Chí Linh' }, { id: 'HD-KM', name: 'Thị xã Kinh Môn' }] },
  { id: 'HGI', name: 'Hậu Giang', type: 'tinh', districts: [{ id: 'HGI-VT', name: 'TP. Vị Thanh' }, { id: 'HGI-NB', name: 'TP. Ngã Bảy' }, { id: 'HGI-LM', name: 'Thị xã Long Mỹ' }] },
  { id: 'HB', name: 'Hòa Bình', type: 'tinh', districts: [{ id: 'HB-TP', name: 'TP. Hòa Bình' }] },
  { id: 'HY', name: 'Hưng Yên', type: 'tinh', districts: [{ id: 'HY-TP', name: 'TP. Hưng Yên' }, { id: 'HY-MH', name: 'Thị xã Mỹ Hào' }] },
  { id: 'KG', name: 'Kiên Giang', type: 'tinh', districts: [{ id: 'KG-RG', name: 'TP. Rạch Giá' }, { id: 'KG-HT', name: 'TP. Hà Tiên' }, { id: 'KG-PQ', name: 'TP. Phú Quốc' }] },
  { id: 'KT', name: 'Kon Tum', type: 'tinh', districts: [{ id: 'KT-TP', name: 'TP. Kon Tum' }] },
  { id: 'LC', name: 'Lai Châu', type: 'tinh', districts: [{ id: 'LC-TP', name: 'TP. Lai Châu' }] },
  { id: 'LD', name: 'Lâm Đồng', type: 'tinh', districts: [{ id: 'LD-DL', name: 'TP. Đà Lạt' }, { id: 'LD-BL', name: 'TP. Bảo Lộc' }] },
  { id: 'LS', name: 'Lạng Sơn', type: 'tinh', districts: [{ id: 'LS-TP', name: 'TP. Lạng Sơn' }] },
  { id: 'LCA', name: 'Lào Cai', type: 'tinh', districts: [{ id: 'LCA-TP', name: 'TP. Lào Cai' }, { id: 'LCA-SP', name: 'Thị xã Sa Pa' }] },
  { id: 'LA', name: 'Long An', type: 'tinh', districts: [{ id: 'LA-TA', name: 'TP. Tân An' }, { id: 'LA-KT', name: 'Thị xã Kiến Tường' }] },
  { id: 'ND', name: 'Nam Định', type: 'tinh', districts: [{ id: 'ND-TP', name: 'TP. Nam Định' }] },
  { id: 'NA', name: 'Nghệ An', type: 'tinh', districts: [{ id: 'NA-V', name: 'TP. Vinh' }, { id: 'NA-CL', name: 'Thị xã Cửa Lò' }, { id: 'NA-TH', name: 'Thị xã Thái Hòa' }, { id: 'NA-HH', name: 'Thị xã Hoàng Mai' }] },
  { id: 'NB', name: 'Ninh Bình', type: 'tinh', districts: [{ id: 'NB-TP', name: 'TP. Ninh Bình' }, { id: 'NB-TD', name: 'TP. Tam Điệp' }] },
  { id: 'NT', name: 'Ninh Thuận', type: 'tinh', districts: [{ id: 'NT-PR', name: 'TP. Phan Rang - Tháp Chàm' }] },
  { id: 'PT', name: 'Phú Thọ', type: 'tinh', districts: [{ id: 'PT-VT', name: 'TP. Việt Trì' }, { id: 'PT-PT', name: 'Thị xã Phú Thọ' }] },
  { id: 'PY', name: 'Phú Yên', type: 'tinh', districts: [{ id: 'PY-TH', name: 'TP. Tuy Hòa' }, { id: 'PY-SC', name: 'Thị xã Sông Cầu' }, { id: 'PY-DH', name: 'Thị xã Đông Hòa' }] },
  { id: 'QB', name: 'Quảng Bình', type: 'tinh', districts: [{ id: 'QB-DH', name: 'TP. Đồng Hới' }, { id: 'QB-BD', name: 'Thị xã Ba Đồn' }] },
  { id: 'QNA', name: 'Quảng Nam', type: 'tinh', districts: [{ id: 'QNA-TK', name: 'TP. Tam Kỳ' }, { id: 'QNA-HA', name: 'TP. Hội An' }, { id: 'QNA-DB', name: 'Thị xã Điện Bàn' }] },
  { id: 'QNG', name: 'Quảng Ngãi', type: 'tinh', districts: [{ id: 'QNG-TP', name: 'TP. Quảng Ngãi' }, { id: 'QNG-DP', name: 'Thị xã Đức Phổ' }] },
  { id: 'QT', name: 'Quảng Trị', type: 'tinh', districts: [{ id: 'QT-DH', name: 'TP. Đông Hà' }, { id: 'QT-QT', name: 'Thị xã Quảng Trị' }] },
  { id: 'ST', name: 'Sóc Trăng', type: 'tinh', districts: [{ id: 'ST-TP', name: 'TP. Sóc Trăng' }, { id: 'ST-VN', name: 'Thị xã Vĩnh Châu' }, { id: 'ST-NN', name: 'Thị xã Ngã Năm' }] },
  { id: 'SL', name: 'Sơn La', type: 'tinh', districts: [{ id: 'SL-TP', name: 'TP. Sơn La' }] },
  { id: 'TN', name: 'Tây Ninh', type: 'tinh', districts: [{ id: 'TN-TP', name: 'TP. Tây Ninh' }, { id: 'TN-TH', name: 'Thị xã Trảng Bàng' }, { id: 'TN-HT', name: 'Thị xã Hòa Thành' }] },
  { id: 'TB', name: 'Thái Bình', type: 'tinh', districts: [{ id: 'TB-TP', name: 'TP. Thái Bình' }] },
  { id: 'TNN', name: 'Thái Nguyên', type: 'tinh', districts: [{ id: 'TNN-TP', name: 'TP. Thái Nguyên' }, { id: 'TNN-SL', name: 'TP. Sông Công' }, { id: 'TNN-PY', name: 'TP. Phổ Yên' }] },
  { id: 'TH', name: 'Thanh Hóa', type: 'tinh', districts: [{ id: 'TH-TP', name: 'TP. Thanh Hóa' }, { id: 'TH-SS', name: 'TP. Sầm Sơn' }, { id: 'TH-BS', name: 'Thị xã Bỉm Sơn' }, { id: 'TH-NS', name: 'Thị xã Nghi Sơn' }] },
  { id: 'TG', name: 'Tiền Giang', type: 'tinh', districts: [{ id: 'TG-MT', name: 'TP. Mỹ Tho' }, { id: 'TG-GC', name: 'TP. Gò Công' }, { id: 'TG-CL', name: 'Thị xã Cai Lậy' }] },
  { id: 'TV', name: 'Trà Vinh', type: 'tinh', districts: [{ id: 'TV-TP', name: 'TP. Trà Vinh' }, { id: 'TV-DH', name: 'Thị xã Duyên Hải' }] },
  { id: 'TQ', name: 'Tuyên Quang', type: 'tinh', districts: [{ id: 'TQ-TP', name: 'TP. Tuyên Quang' }] },
  { id: 'VL', name: 'Vĩnh Long', type: 'tinh', districts: [{ id: 'VL-TP', name: 'TP. Vĩnh Long' }, { id: 'VL-BM', name: 'Thị xã Bình Minh' }] },
  { id: 'VP', name: 'Vĩnh Phúc', type: 'tinh', districts: [{ id: 'VP-VY', name: 'TP. Vĩnh Yên' }, { id: 'VP-PY', name: 'TP. Phúc Yên' }] },
  { id: 'YB', name: 'Yên Bái', type: 'tinh', districts: [{ id: 'YB-TP', name: 'TP. Yên Bái' }, { id: 'YB-NL', name: 'Thị xã Nghĩa Lộ' }] }
];
