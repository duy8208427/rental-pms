# Rental PMS — Quản lý VP / KS / Xưởng

Hệ thống quản lý cho thuê hỗn hợp: văn phòng, khách sạn, xưởng.  
Một unit có thể thuê **ngắn ngày (booking)** hoặc **dài hạn (hợp đồng)** — cùng engine **Occupancy** chống chồng lịch.

## Chạy dự án & đăng nhập

**Xem đầy đủ tại [HUONG-DAN.md](HUONG-DAN.md)** — thứ tự terminal, lệnh, URL, tài khoản demo, seed, sự cố thường gặp.

Tóm tắt nhanh:

| | |
|--|--|
| Website khách | http://127.0.0.1:5173/ (đặt phòng + lịch cho thuê ẩn danh `/lich`) |
| Admin | http://127.0.0.1:5173/admin/login |
| Quản trị (admin) | `admin@example.com` / `admin123` |
| Người quản lý KS | `manager.hotel@example.com` / `manager123` (mobile) |
| Khách thuê (tenant) | `tenant@example.com` / `tenant123` |
| API | http://127.0.0.1:8000/docs |

## Stack

| Phần | Công nghệ |
|------|-----------|
| Backend | FastAPI + SQLAlchemy 2 + JWT |
| DB | SQLite (mặc định) hoặc PostgreSQL |
| Web | React + Vite + Tailwind (khách + admin) |
| Mobile | Expo Router (admin / manager / tenant) |

## Cấu trúc

```
backend/   # API port 8000
web/       # Web khách + admin port 5173
mobile/    # Expo app
HUONG-DAN.md
docker-compose.yml  # Postgres tùy chọn
```

## Module chính

- Website đặt phòng (popup wizard) + lịch cho thuê công khai (ẩn tên) + admin Room Board / Lịch cho thuê / Booking / Hợp đồng / Tài chính / Tài sản
- Occupancy dùng chung cho booking ngắn ngày và hợp đồng dài hạn; lịch xem Tháng/Năm kiểu Google Calendar
- Tạo booking / hợp đồng / tài sản qua popup; chi phí cần thời gian đóng + ảnh trước khi đánh dấu đã đóng
- Mobile: admin/manager (phòng hôm nay, thu tiền) · tenant (hợp đồng, hóa đơn, thanh toán MoMo/VietQR, lịch KS)

## Vai trò

**3 vai trò**:

| Vai trò | Kênh | Phạm vi |
|---------|------|---------|
| `admin` | Web `/admin` (+ mobile nếu cần) | Toàn hệ thống |
| `manager` | **Chỉ mobile** | 1 cơ sở (`Property`) được giao — phòng hôm nay + thu tiền |
| `tenant` | Mobile | Khách thuê — hợp đồng/hóa đơn, thanh toán online, lịch KS ẩn danh |
