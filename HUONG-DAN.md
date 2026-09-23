# Hướng dẫn chạy dự án — Rental PMS (Harbor Stay)

Quản lý cho thuê hỗn hợp (văn phòng, khách sạn, xưởng): web đặt phòng cho khách, web admin cấu hình toàn hệ thống, mobile cho người quản lý theo căn và khách thuê.

**Đọc file này trước khi chạy.** README chỉ tóm tắt; chi tiết thao tác nằm ở đây.

---

## Yêu cầu môi trường

| Công cụ | Ghi chú |
|---------|---------|
| Python 3.11+ | Backend FastAPI |
| Node.js 18+ + npm | Web Vite + Mobile Expo |
| (Tuỳ chọn) Docker | PostgreSQL thay SQLite |
| (Tuỳ chọn) Android Studio / Expo Go | Chạy app mobile |

Database mặc định: **SQLite** (`backend/rental_pms.db`) — không cần cài MongoDB hay Postgres để chạy demo.

Thư mục gốc dự án (PowerShell):

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng"
```

---

## Thứ tự chạy (local)

Giữ mỗi bước **một terminal riêng**, không đóng terminal đang chạy.

### Bước 1 — Backend API (port 8000)

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Lần đầu: copy .env.example .env  (nếu chưa có file .env)
python scripts\seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Kiểm tra:

- http://127.0.0.1:8000/api/health → `{"ok":true}`
- http://127.0.0.1:8000/docs → Swagger API

`seed.py` sẽ **xoá và tạo lại** toàn bộ dữ liệu demo. Chỉ chạy khi cần reset.

---

### Bước 2 — Web (port 5173)

Backend phải đang chạy.

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng\web"
npm install
npm run dev
```

Hoặc:

```powershell
npx vite --host 127.0.0.1 --port 5173
```

Nếu báo port 5173 bận, Vite có thể mở **5174** — xem dòng `Local:` trong terminal.

---

### Bước 3 — Mobile (tuỳ chọn)

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng\mobile"
npm install
npx expo start
```

- **Android emulator:** API mặc định `http://10.0.2.2:8000`
- **Máy thật:** tạo biến môi trường hoặc set  
  `EXPO_PUBLIC_API_URL=http://<IP-máy-PC>:8000`  
  (PC và điện thoại cùng Wi‑Fi; firewall cho phép port 8000)

---

## Địa chỉ truy cập

| Ứng dụng | URL |
|----------|-----|
| Website đặt phòng (khách) | http://127.0.0.1:5173/ |
| Lịch cho thuê công khai (ẩn tên) | http://127.0.0.1:5173/lich |
| Đăng nhập quản trị | http://127.0.0.1:5173/admin/login |
| Dashboard admin (sau login) | http://127.0.0.1:5173/admin |
| API docs | http://127.0.0.1:8000/docs |

Khách **không cần đăng nhập**: trang chủ → **Tìm phòng** (popup wizard) hoặc bấm card cơ sở; menu **Lịch phòng** (`/lich`) xem lịch cho thuê ẩn tên khách.

---

## Tài khoản demo

Sau khi chạy `python scripts\seed.py`:

Hệ thống có **3 vai trò**: `admin` (quản trị web), `manager` (người quản lý — chỉ mobile, 1 căn), `tenant` (khách thuê).

| Vai trò | Email | Mật khẩu | Dùng ở đâu |
|---------|-------|----------|------------|
| Quản trị (`admin`) | `admin@example.com` | `admin123` | Web `/admin/login` (cấu hình toàn hệ thống); có thể vào mobile xem tất cả căn |
| Người quản lý KS | `manager.hotel@example.com` | `manager123` | **Chỉ mobile** — phòng hôm nay + thu tiền của Khách sạn Mini Riverside |
| Người quản lý VP | `manager.office@example.com` | `manager123` | **Chỉ mobile** — Tòa văn phòng Center |
| Người quản lý xưởng | `manager.workshop@example.com` | `manager123` | **Chỉ mobile** — Xưởng thuê Đông Á |
| Khách thuê (`tenant`) | `tenant@example.com` | `tenant123` | App mobile — hợp đồng, hóa đơn, thanh toán online, lịch KS |

**Phân công:** mỗi người quản lý phụ trách **1 cơ sở (Property)**. Ví dụ seed có 3 căn → 3 tài khoản manager. Admin tạo/sửa/vô hiệu hóa và gán căn trên web **Người quản lý** (`/admin/managers`). Quản trị cấu hình (booking, HĐ, tài sản, chi phí…) trên **web admin**; vận hành tại chỗ trên **mobile manager**.

### Gợi ý thử nhanh

1. Mở http://127.0.0.1:5173/ → đặt phòng qua popup (không login).
2. Mở http://127.0.0.1:5173/lich → **Lịch cho thuê** ẩn danh (Tháng / Năm kiểu Google Calendar).
3. Mở http://127.0.0.1:5173/admin/login → `admin@example.com` / `admin123`.
4. Vào **Người quản lý** để xem/gán căn hoặc thêm tài khoản mới; vào **Booking** / **Hợp đồng** / **Sơ đồ phòng** / **Lịch cho thuê** để thấy dữ liệu demo.
5. Mobile tenant: đăng nhập `tenant@example.com` → **Hóa đơn** → Thanh toán online (MoMo / VietQR).
6. Mobile manager: đăng nhập `manager.hotel@example.com` → chỉ thấy phòng/hóa đơn căn KS (không vào được web admin).
7. Mobile admin: đăng nhập `admin@example.com` → phòng hôm nay / thu tiền (mọi căn).

---

## Menu admin & thao tác UI (cập nhật)

Menu trái sau đăng nhập:

| Menu | Đường dẫn | Ghi chú |
|------|-----------|---------|
| Tổng quan | `/admin` | Dashboard |
| Sơ đồ phòng | `/admin/rooms` | Màu trạng thái: **Trống** (xanh lá) ≠ **Đang thuê** (xanh dương) |
| Lịch cho thuê | `/admin/calendar` | Trước đây tên “Lịch chiếm chỗ” |
| Khách thuê | `/admin/tenants` | CCCD / giấy tờ |
| Người quản lý | `/admin/managers` | Tạo/sửa tài khoản mobile, gán 1 cơ sở (`Property`), vô hiệu hóa |
| Hợp đồng | `/admin/contracts` | Tạo HĐ qua nút popup |
| Booking | `/admin/bookings` | Tạo booking qua nút popup |
| Tài chính | `/admin/finance` | Hóa đơn thu + chi phí |
| Tài sản | `/admin/assets` | Thêm tài sản qua popup giữa màn hình |

### Lịch cho thuê (admin + `/lich` + mobile)

- Xem theo **Tháng** (lưới CN–T7) hoặc **Năm** (12 mini-calendar).
- Nút **Hôm nay**, mũi tên prev/next; chọn cơ sở bằng dropdown.
- Pill màu: **Booking** (teal) / **Hợp đồng** (cam). Bấm pill → popup **Từ / Đến** (định dạng `dd/mm/yyyy`).
- Năm: ngày có chiếm chỗ được tô màu; bấm tháng → về chế độ Tháng.

### Booking & Hợp đồng

- Form tạo **không** nằm sẵn trên trang: bấm **+ Tạo booking** / **+ Tạo hợp đồng** (góc phải trên) → form trong popup giữa màn hình.
- Dropdown khách: placeholder **-Chọn-**.
- Action bảng (Check-in / Check-out / Hủy / Gia hạn / Thanh lý): hover có gạch chân.

### Tài chính — chi phí

- Cột **Thời gian đóng**: chọn bằng picker tùy chỉnh (bo góc, màu chủ đạo teal).
- **Upload** ảnh chứng từ.
- Nút **Đánh dấu đã đóng** chỉ bật khi đã có **thời gian đóng** và **ảnh**. API từ chối nếu thiếu một trong hai.

### Ngày tháng trên web

Các ô ngày hiển thị / nhập theo **`dd/mm/yyyy`** (DateField), không dùng `yyyy-mm-dd` trên UI.

---

## Thanh toán online (MoMo + PayOS)

Copy biến từ `backend/.env.example` vào `backend/.env`.

| Biến | Ý nghĩa |
|------|---------|
| `PAYMENT_MODE=sandbox` | Demo local: tạo giao dịch giả, mở URL sandbox để bấm xác nhận |
| `PAYMENT_MODE=live` | Gọi MoMo / PayOS thật (cần key) |
| `PUBLIC_API_BASE` | Base URL API (webhook / redirect); local dùng ngrok nếu IPN từ internet |
| `MOMO_*` | Partner code, access/secret key, endpoint, IPN |
| `PAYOS_*` | Client id, API key, checksum key (VietQR / CKNH) |

**Flow sandbox**

1. Tenant tạo `POST /api/payments/online` với `method: momo` hoặc `vietqr`.
2. App mở `pay_url` → trang sandbox → bấm **Xác nhận đã chuyển tiền**.
3. Backend chuyển payment → `confirmed`, cộng `paid_amount` hóa đơn.
4. App poll `GET /api/payments/{id}` → hiện thành công.

**Flow live**

1. Cấu hình key MoMo/PayOS, đặt `PAYMENT_MODE=live`.
2. Đăng ký webhook: `{PUBLIC_API_BASE}/api/webhooks/momo` và `/api/webhooks/payos` (dùng ngrok khi dev).
3. Tenant thanh toán trên cổng; IPN xác nhận tự động.

---

## Dữ liệu seed gồm gì

- 1 khách sạn (8 phòng), 1 tòa văn phòng (6 unit), 1 xưởng (3 gian)
- Booking / hợp đồng / hóa đơn / chi phí mẫu
- Tenant demo có hóa đơn còn nợ (tiền thuê + đặt cọc) để thử thanh toán
- Tài sản gắn vài phòng KS

---

## PostgreSQL (tuỳ chọn)

Mặc định dùng SQLite. Nếu muốn Postgres:

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng"
docker compose up -d
```

Sửa `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://rental:rental@localhost:5432/rental_pms
```

Rồi:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python scripts\seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| Web gọi API lỗi / đăng nhập fail | Kiểm tra backend còn chạy port 8000 |
| `admin@…` sai mật khẩu sau khi sửa code | Chạy lại `python scripts\seed.py` |
| Port 5173 bận | Dùng URL Vite in ra (có thể 5174) hoặc tắt process cũ |
| Mobile không kết nối API | Emulator dùng `10.0.2.2`; máy thật dùng IP LAN + `EXPO_PUBLIC_API_URL` |
| Đặt phòng trùng ngày → 409 | Đúng hành vi: phòng đã bị chiếm |
| Không bấm được “Đánh dấu đã đóng” | Chọn thời gian đóng + Upload ảnh trước |
| Popup tạo booking/HĐ/tài sản lệch màn hình | Đã dùng Modal portal giữa viewport; refresh cứng (Ctrl+F5) nếu cache cũ |

---

## Tóm tắt lệnh (đã cài sẵn)

**Terminal 1 — API**

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng\backend"
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Web**

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng\web"
npm run dev
```

**Terminal 3 — Mobile (nếu cần)**

```powershell
cd "D:\New folder\Quản lý VP, KS, Xưởng\mobile"
npx expo start
```
