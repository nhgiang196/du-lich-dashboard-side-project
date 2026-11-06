# Kế hoạch: dev environment + deploy GitHub + Vercel + CI/CD

Trạng thái: **chưa triển khai** (repo mới clone, đang trống). Tài liệu này là bản bàn giao để session làm việc trong repo tiếp tục.

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

## Cần người dùng
- Xác nhận Vercel (không phải VPS).
- Quyết định có đưa trang Đà Lạt vào repo này không (bản tham chiếu đang ở `docs/reference/dalat-trip/index.html`).
- Cài Vercel GitHub App + `vercel login` + bật branch protection.
- Không bao giờ dán token/mật khẩu vào chat.
