# Du Lịch Dashboard · Đà Lạt 16–19/11/2026

Ứng dụng lên kế hoạch và theo dõi chuyến đi **Đà Lạt 16–19/11/2026** (2 người, 4N3Đ), xây dựng trên nền **Vite + TypeScript + Three.js** với kiểm thử tự động **Vitest**, **Biome** và **GitHub Actions CI**.

## Tính năng chính
- **Mô hình 3D Đà Lạt (`three.js`)**: Cảnh đồi thông và biển mây low-poly tương tác chuột/cảm ứng, tự thích ứng Dark Mode và mật độ biển mây theo điểm săn mây dự báo.
- **7 Tab quản lý chuyến đi**:
  1. `Lịch trình`: Tick tiến độ, tự động gợi ý **Plan B** theo ngưỡng mưa từng buổi, đổi lịch săn mây Cầu Đất ↔ Đồi Đa Phú (17/11 & 18/11), mở nhanh tuyến đường xe máy trên Google Maps.
  2. `Thời tiết`: Dữ liệu thực tế từ Open-Meteo (Forecast 16 ngày + dữ liệu khí hậu 2018–2025 dự phòng) và công thức chấm điểm săn mây khung 5h–7h sáng.
  3. `Ăn mặc`: Gợi ý trang phục theo khung giờ, kiểm tra độ tương phản màu quần áo trên nền đồi chè / rừng thông / sương mù Đà Lạt và checklist đồ mang theo.
  4. `Đặt trước`: Theo dõi các mục cần đặt, đã đặt và đã hủy.
  5. `Chi phí`: Tính tổng chi phí theo nhóm, thanh tiến độ ngân sách 8.000.000 đ và chia đầu người.
  6. `Phương án`: Các phương án dự phòng khi mưa hoặc đổi lịch.
  7. `Checklist`: Các việc quan trọng trước giờ khởi hành.
- **Lưu trữ trình duyệt**: Tự động lưu trạng thái vào `localStorage` (`dalat-trip-v7`).

## Lệnh phát triển (Local Development)

```bash
# Cài đặt dependencies
npm install

# Chạy máy chủ dev (http://localhost:5173)
npm run dev

# Kiểm tra lint & format với Biome
npm run lint

# Kiểm tra kiểu TypeScript
npm run typecheck

# Chạy unit tests với Vitest
npm test

# Build bản Production (tách riêng chunk three.js)
npm run build
```

## Kết nối Vercel (Deploy)
1. Cài **Vercel GitHub App** cho repository trên GitHub.
2. Đăng nhập và liên kết dự án qua CLI (không dán token vào chat):
   ```bash
   npx vercel login
   npx vercel link
   ```
3. Mỗi Pull Request sẽ tự động có **Preview URL** và khi merge vào `main` sẽ tự động deploy lên **Production**.
