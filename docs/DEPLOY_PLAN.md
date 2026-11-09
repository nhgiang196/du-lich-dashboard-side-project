# Kế hoạch: dev environment + deploy GitHub + Vercel + CI/CD

Trạng thái: **đã triển khai code, CI và cấu hình Vercel** (cần người dùng kết nối tài khoản Vercel CLI / GitHub App ở bước cuối). Tài liệu này là bản bàn giao để session làm việc trong repo tiếp tục.

## Mục tiêu
- Môi trường dev nhẹ, công nghệ mới, dễ tích hợp three.js về sau.
- Deploy tự động: mỗi PR có Preview URL, merge vào `main` thì lên Production.
- CI kiểm tra chất lượng trước khi merge.

## Quyết định đã chốt
- Stack: **Vite + TypeScript + three.js** (vanilla-ts template).
- Hosting: **Vercel** (Git Integration). Vercel là serverless/CDN, không phải máy chủ riêng.
  - Phương án thay thế nếu muốn VPS: Docker + nginx + GitHub Actions deploy qua SSH. (Chưa xác nhận lựa chọn cuối với chủ repo.)
- Repo: https://github.com/nhgiang196/du-lich-dashboard-side-project (private/trống lúc clone).

## Bước 1. Scaffold
- `npm create vite@latest . -- --template vanilla-ts`
- `npm i three` và `npm i -D @types/three vitest eslint prettier` (hoặc Biome thay ESLint + Prettier).
- Tách chunk `three`: `build.rollupOptions.output.manualChunks` trong `vite.config.ts`.
- Thư mục tài nguyên 3D: `public/models`, `public/textures`. Thêm `vite-plugin-glsl` khi cần shader.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck` (`tsc --noEmit`), `test`.
- Cảnh three.js mẫu (một khối xoay) để kiểm tra nhanh.

## Bước 2. CI (GitHub Actions)
File `.github/workflows/ci.yml`, chạy trên `pull_request` và push `main`:
1. `actions/checkout`, `actions/setup-node` (Node 20, cache npm)
2. `npm ci`
3. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

## Bước 3. Deploy (Vercel)
- Framework Preset: Vite. Build: `npm run build`. Output: `dist`.
- `vercel.json` tối giản: rewrite về `index.html` nếu là SPA; header `Cache-Control: public, max-age=31536000, immutable` cho `/assets/*`.
- Biến môi trường đặt trong Vercel (Preview và Production tách riêng). Không commit `.env`.
- Branch protection `main`: bắt buộc CI xanh + check của Vercel trước khi merge.

### Cách kết nối Vercel
Ưu tiên CLI, người dùng chỉ cần đăng nhập một lần:
1. Người dùng cài **Vercel GitHub App** cho repo (chỉ làm được bằng tay trên github.com).
2. `npx vercel login` (xác nhận trong trình duyệt, không dán token vào chat).
3. `vercel link`, `vercel git connect`, `vercel env add` khi cần.
4. Push `main` để có bản Production đầu tiên.

Vercel có MCP server chính thức (`https://mcp.vercel.com`, OAuth), hữu ích để đọc project, deployment, log build. Khả năng tạo project / nối Git qua MCP chưa kiểm chứng.

## Kiểm tra khi xong
1. `npm run dev` hiển thị cảnh three.js mẫu.
2. `npm run build` và `npm run preview` chạy đúng, console không lỗi.
3. Mở PR thử: Actions xanh và Vercel tạo Preview URL; merge thì Production cập nhật.
4. Kiểm tra giao diện 375px và dung lượng chunk `three`.

## Bảo vệ cơ bản trên Vercel (2 người dùng)
- Không dùng Serverless Functions hay `@vercel/analytics` để tránh phát sinh request/invocation không cần thiết khi bị bot quét; toàn bộ app là **100% Static Assets** được phục vụ trực tiếp từ Vercel Edge CDN.
- Chặn bot/crawler tự động qua `public/robots.txt` (`Disallow: /`), thẻ `<meta name="robots" content="noindex, nofollow, noarchive">` và header `X-Robots-Tag`, `Content-Security-Policy`, `X-Frame-Options: DENY` trong `vercel.json`.
- Giới hạn tần suất gọi API thời tiết phía client (`WEATHER_COOLDOWN_MS = 30s`) và tự động dùng cache offline khi mất mạng.
- **Tùy chọn trên giao diện Vercel**: Vào **Project Settings → Security (Firewall)** bật **Vercel Bot Fight Mode / Attack Challenge Mode** nếu muốn chặn triệt để traffic tự động.

## Cần người dùng
- Cài Vercel GitHub App + `vercel login` + bật branch protection.
- Không bao giờ dán token/mật khẩu vào chat.
