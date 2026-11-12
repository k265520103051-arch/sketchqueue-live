# Review toàn nhánh — 2026-11-12 (HEAD bbdd403)

Người review: Claude Fable 5.2, ngữ cảnh mới, chỉ đọc. `npm test` 153/153, `tsc` sạch.
Không có lỗi Critical. Phần TikTok đối chiếu với `.d.ts` của `tiktok-live-connector` 2.5.0, chưa thử phiên live thật.

## Important — chưa sửa

| Mã | Vị trí | Chuyện gì xảy ra | Hướng sửa |
|---|---|---|---|
| I1 | `src/client/control/control.ts:291,322`, `src/core/session.ts:115` | Giữ phím S hoặc bấm đúp "Bỏ qua" làm bỏ qua nhiều người; "Vẽ lại" không cứu được | `skip` mang `id`, session bỏ qua id lệch; bỏ qua `ev.repeat` |
| I2 | `src/sources/tiktok.ts:114` | Một lỗi giải mã lẻ của thư viện bị coi là "Lỗi kết nối" dù vẫn đang nối; nút Ngắt bị khoá | Sau khi đã nối, `error` chỉ ghi vào dòng sự kiện |
| I3 | `src/server/app.ts:196-227` | Kết nối treo ở máy chủ ký thì mọi nút kết nối đứng im | Giới hạn `start()` khoảng 30 s; `disconnect` huỷ được lượt đang chờ |
| I4 | `src/sources/tiktok.ts:100-107` | Chuỗi quà (streak) mất hẳn nếu sự kiện `repeatEnd` không tới | Nhớ sự kiện dở cuối cùng, phát sau 5–10 s hoặc khi ngắt |
| I5 | `src/server/main.ts:24` | Nối lại có thể đếm đôi quà/bình luận gần đây (chưa kiểm được) | `processInitialData: false` hoặc lọc theo `common.msgId` |
| I6 | `src/sources/tiktok.ts:113` | Rớt kết nối giữa buổi chỉ đổi một nhãn nhỏ; "Live đã kết thúc" bị ghi đè | Dải cảnh báo rõ; bỏ qua `disconnected` sau `streamEnd` |
| I7 | `src/server/app.ts:157,311`, `src/server/avatar.ts:50` | Ảnh lỗi bị tải lần hai trong lúc đồng hồ vẽ đã chạy; ảnh thay thế hiện muộn | Lưu kết quả tải trước theo id bức vẽ, lỗi thì trả 404 ngay |
| I8 | `src/core/session.ts:175`, `src/core/stats.ts:41` | Mỗi lần phát trạng thái gửi cả danh sách người tặng, lớn dần không giới hạn | Giữ `coinsByUser` ở máy chủ, chỉ gửi `topGifters` |

## Minor — để sau

- M1 Proxy ảnh theo redirect, không chặn host nội bộ, đệm cả body trước khi kiểm 2 MB.
- M2 Kết nối thất bại báo hai dòng (tiếng Anh).
- M3 `Session` mặc định `Math.random` trong `src/core`.
- M4 Bút có thể giật khoảng 100 ms (suy ra, chưa quan sát).
- M5 Tranh vẽ xong biến mất ngay, không giữ lại.
- M6 `settings.json` có BOM bị coi là hỏng, về mặc định.
- M7 Quà 0 xu vẫn tính "Lượt quà".
- M8 `member` luôn coi là tham gia.
- M9 Handle rỗng hiện chỉ `@`.
- M10 "Tự nhập" không giới hạn độ dài tên.
- M11 CSP thiếu `frame-ancestors 'none'`.
- M12 "Vẽ lại" có thể gộp nhầm quà mới.
- M13 Máy ngủ rồi thức làm bức đang vẽ xong tức thì.
- M14 Đặt gộp = 0 giây vẫn gộp hai quà trùng đúng một mili giây (`src/core/queue.ts:41`).
- Test: fixture TikTok không gắn kiểu của thư viện nên sai tên trường vẫn qua; vài test không thể sai.

## Chưa thể đánh giá khi chưa có phiên live thật

- `roomUser.total` có đúng là số người xem không.
- `repeatCount` ở quà không streak; `gift.type === 1` có phủ hết quà streak không.
- Máy chủ ký Euler bản không khoá có nối được không, giới hạn bao nhiêu. Thư viện đọc biến môi trường `SIGN_API_KEY` nếu có.
- Ảnh đại diện thật có định dạng trình duyệt của OBS đọc được không.

## Đã kiểm, ổn

Người tặng liên tục không chặn ai; bỏ qua/xoá hết khi đang vẽ hoặc tạm dừng; đầu vào kết nối lạ bị chặn trước khi gọi mạng; kiểm Host/Origin; chặn path traversal; giới hạn kích thước tin; không có `innerHTML`; tên trường và tên sự kiện TikTok khớp `.d.ts`.

## Kết quả lượt sửa (2026-11-12, commit f10e848..ccc3e16)

| Mã | Kết quả |
|---|---|
| I1 | Đã sửa: lệnh bỏ qua mang id bức đang vẽ; phím giữ lặp bị bỏ qua |
| I2 | Đã sửa: bảng lỗi trên trang điều khiển; lỗi lẻ chỉ ghi; mất kết nối thì vẽ nốt bức đang vẽ rồi dừng, hàng chờ giữ nguyên |
| I3, I4, I5 | Chủ dự án quyết định bỏ qua |
| I6 | Nhãn trạng thái to hơn (13px → 19.5px, đậm); "Live đã kết thúc" không còn bị ghi đè |
| I7 | Đã sửa: mỗi lượt tải ảnh một lần, dùng chung cho cả lúc vẽ và `/api/avatar`; tải trước lượt đứng đầu hàng chờ |
| I8 | Đã sửa: thay danh sách người tặng bằng bảng xếp hạng theo khung 5 phút (giữ 12 bảng đã khoá + 1 bảng đang chạy, mỗi bảng top 10) |

Kiểm: `npm test` 177/177, `npm run typecheck` sạch, `npm run build:client` thành công.
