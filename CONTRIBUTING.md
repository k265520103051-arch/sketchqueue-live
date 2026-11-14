# Đóng góp cho SketchQueue LIVE

## Chuẩn bị môi trường

Có hai cách.

**Cách 1: GitHub Codespaces (không cần cài gì).**
Trên trang repo, chọn **Code → Codespaces → Create codespace on main**. Môi trường có sẵn Node 24 và tự chạy `npm ci`.

**Cách 2: Trên máy của bạn.**
Cài Node.js 20 trở lên (khuyên dùng 24), rồi chạy trong thư mục dự án:

```
npm ci
```

## Cấu hình

`settings.json` không được đưa lên Git, vì mỗi người có cấu hình riêng. Nếu thiếu file này, app dùng giá trị mặc định. Muốn bắt đầu từ cấu hình mẫu, chép `settings.example.json` thành `settings.json`.

## Chạy và kiểm tra

```
npm start          # build giao diện và chạy máy chủ ở cổng 4780
npm test           # chạy toàn bộ test (vitest)
npm run typecheck  # kiểm tra kiểu TypeScript
```

Trong Codespaces, cổng 4780 được tự chuyển tiếp. Mở cổng đó ở tab **Ports**. Hãy để cổng ở chế độ **Private**, vì bảng điều khiển không có đăng nhập.

Phải có kết nối TikTok LIVE thật mới thử được phần kết nối. Phần còn lại thử được bằng chế độ diễn tập trên bảng điều khiển.

## Quy ước

- `src/core` là phần lõi thuần. Không import `node:*` và không gọi `Date.now()` hay `Math.random()` trong đó. Thời gian luôn được truyền vào.
- Viết test trước khi sửa hành vi, theo kiểu TDD.
- Chữ trên giao diện viết bằng tiếng Việt. Nội dung do người xem nhập luôn gán bằng `textContent`, không dùng `innerHTML`.

## Gửi thay đổi

1. Tạo nhánh mới từ `main`, ví dụ `fix/ten-loi` hoặc `feat/ten-tinh-nang`.
2. Trước khi mở PR, `npm test` và `npm run typecheck` phải xanh.
3. Mở pull request vào `main` và mô tả ngắn thay đổi cùng cách đã kiểm tra.
