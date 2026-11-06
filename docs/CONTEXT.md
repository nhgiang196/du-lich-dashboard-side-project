# Bối cảnh dự án (bàn giao từ session trước)

## Nguồn gốc
Session trước dùng để lên kế hoạch chuyến đi **Đà Lạt 16–19/11/2026** (2 người, 4 ngày 3 đêm, đi xe giường nằm từ Sài Gòn, ngân sách 5–8 triệu), sau đó chuyển sang chuẩn bị repo này.

## Trang Đà Lạt (đã hoàn thành)
- Bản tham chiếu: `docs/reference/dalat-trip/index.html` (một file HTML/CSS/JS thuần, không build).
- Tab: Lịch trình, Thời tiết, Ăn mặc, Đặt trước, Chi phí, Phương án, Checklist.
- Dữ liệu thời tiết lấy từ Open-Meteo (forecast, rồi climate archive làm dự phòng). Trạng thái lưu localStorage (khoá `dalat-trip-v7`). Có dark mode, đã kiểm tra mobile 375px.
- Rain Plan B theo từng khung giờ, điểm "săn mây" tính bằng heuristic.
- Khách sạn đã chốt: Faru Pine Woods Villa (873.000đ / 2 đêm), New Life Hotel (919.000đ).
- Tổng chi phí ước tính khoảng 6.152.000đ (chưa gồm bữa ăn 19/11).
- Đã bỏ: tab Cảm hứng (Pinterest/TikTok) và dòng ăn mặc trong Lịch trình; vẫn giữ tag concept.

## Ràng buộc đã thống nhất
- Không scrape/tải nội dung Pinterest/TikTok (vi phạm điều khoản); chỉ dùng embed chính thức nếu cần.
- Không xử lý token/mật khẩu trong chat.

## Việc tiếp theo
Xem `docs/DEPLOY_PLAN.md`.
