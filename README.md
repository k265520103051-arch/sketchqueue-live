# SketchQueue LIVE

SketchQueue LIVE là ứng dụng chạy trên máy tính cho người livestream TikTok. Người xem tặng quà (hoặc gõ một từ khoá trong bình luận) sẽ được xếp vào hàng chờ, và trang sân khấu vẽ ảnh đại diện của từng người thành một bức chân dung dạng nét sóng để hiển thị trên OBS.

## Yêu cầu

- Node.js 20 trở lên.
- Windows, macOS hoặc Linux.
- Một trình duyệt web (Chrome, Edge, Firefox...) để mở bảng điều khiển.

## Chạy

Các lệnh dưới đây phải chạy **bên trong thư mục `sketchqueue-live`**. Nếu chạy ở thư mục cha, bạn sẽ gặp lỗi ENOENT báo không tìm thấy `package.json`.

```
npm install
npm start
```

Sau khi khởi động, có hai địa chỉ:

- Bảng điều khiển: `http://127.0.0.1:4780/`
- Sân khấu: `http://127.0.0.1:4780/stage`

Cổng mặc định là 4780. Nếu cổng bị chương trình khác dùng, hãy đổi bằng biến môi trường `PORT`:

PowerShell:

```
$env:PORT=4781; npm start
```

bash:

```
PORT=4781 npm start
```

Khi đó hai địa chỉ trên sẽ dùng cổng 4781. Lần chạy đầu tiên sẽ build giao diện trước (`npm start` gọi `build:client`), nên có thể mất vài giây.

## Nối vào phiên live

Nhập vào ô "Link hoặc tên tài khoản TikTok" trên bảng điều khiển, rồi bấm **Kết nối thật**. Các dạng được chấp nhận:

- Tên tài khoản, có hoặc không có dấu `@`: `@ten` hoặc `ten`. Tên gồm chữ, số, dấu chấm và dấu gạch dưới, dài 2 đến 24 ký tự.
- Link TikTok có hoặc không có `https://`, dùng tên miền `tiktok.com`, `www.tiktok.com` hoặc `m.tiktok.com`, ví dụ `https://www.tiktok.com/@ten` hoặc `https://www.tiktok.com/@ten/live`. Phần sau tên tài khoản (tham số, đường dẫn con) bị bỏ qua.

Các dạng bị từ chối, kèm thông báo hiển thị trên giao diện:

| Đầu vào | Thông báo |
|---|---|
| Ô để trống | Hãy nhập link hoặc tên tài khoản TikTok |
| Tên sai định dạng, ví dụ `@@ten` hoặc tên quá ngắn | Tên tài khoản không hợp lệ |
| Chuỗi không phải URL hợp lệ, hoặc giao thức khác http/https | Link không hợp lệ |
| Link rút gọn `vm.tiktok.com` hoặc `vt.tiktok.com` | Link rút gọn chưa được hỗ trợ. Hãy mở link, rồi dán link dạng tiktok.com/@ten |
| Link của trang khác | Đây không phải link TikTok |
| Link TikTok nhưng không có `@ten` ở đầu đường dẫn, ví dụ `tiktok.com/video/...` | Link không chứa tên tài khoản (@ten) |

Khi kết nối thành công, dòng trạng thái và mã phòng (room) sẽ hiện trên bảng điều khiển. Nút **Ngắt** dừng kết nối.

## Đưa sân khấu lên sóng

Trong OBS, thêm nguồn **Browser Source** với các thông số:

- URL: `http://127.0.0.1:4780/stage`
- Chiều rộng: 540
- Chiều cao: 960

Bảng điều khiển có nút "Mở sân khấu" để xem trước trang sân khấu trong trình duyệt.

## Diễn tập

Nút **Diễn tập** chạy bộ sự kiện giả lập, không kết nối TikTok. Dùng để kiểm tra toàn bộ luồng trước khi lên sóng.

Hàng nút thử nằm trên bảng điều khiển:

- **Tặng thử**: chọn quà (Rose 1 xu, Mũ 99 xu) và số lượng, rồi gửi cho người thử đang nhập ở ô "Người thử".
- **Bình luận thử**: gửi nội dung bình luận tuỳ ý. Gõ từ khoá xin vẽ (mặc định `!ve`) để thử luật xin vẽ không quà.
- **Thả 10 tim thử**: gửi 10 lượt tim từ người thử.

Ô "Người thử" mặc định là `mai_test`. Các tên mẫu dùng để thử là `mai_test`, `bao_test` và `linh_test`. Nếu muốn thử xin vẽ không quà ngay từ đầu buổi, hãy đặt "Nhận xin vẽ khi không có quà trong (giây)" về 0 trong phần Cài đặt.

## Cài đặt

Cài đặt được lưu vào file `settings.json` nằm cạnh ứng dụng, và được đọc lại khi khởi động. Giao diện hiển thị thời gian bằng giây và tỉ lệ bằng phần trăm; trong `settings.json` các giá trị thời gian được lưu bằng mili-giây (ví dụ 60000).

| Nhãn trên giao diện | Khoá trong `settings.json` | Ý nghĩa | Mặc định | Khoảng cho phép |
|---|---|---|---|---|
| Số xu tối thiểu để vào hàng | `minCoins` | Quà có số xu thấp hơn mức này bị bỏ qua | 1 xu | Số nguyên từ 1 trở lên |
| Gộp quà trong (giây) | `combineWindowMs` | Quà mới của cùng một người trong khoảng này được cộng vào lượt đang chờ | 60 giây | 0 đến 600 giây |
| Hàng chờ tối đa | `maxQueue` | Số lượt tối đa trong hàng chờ | 50 | Số nguyên từ 1 đến 500 |
| Nhận quà | `acceptingGifts` | Tắt thì quà không vào hàng chờ mà được ghi vào "Nợ vẽ sau" | Bật | Bật / tắt |
| Cho xin vẽ miễn phí | `allowFreeRequests` | Bật hoặc tắt nhận yêu cầu xin vẽ không quà | Bật | Bật / tắt |
| Từ khoá xin vẽ | `freeKeyword` | Từ khoá đầu bình luận để xin vẽ không quà | `!ve` | 1 đến 20 ký tự, không có khoảng trắng |
| Nhận xin vẽ khi không có quà trong (giây) | `freeIdleMs` | Sau khoảng im lặng này (tính từ quà gần nhất, hoặc từ lúc mở ứng dụng) thì nhận xin vẽ | 120 giây | 0 đến 3600 giây |
| Tỉ lệ ngẫu nhiên (%) | `freeChance` | Xác suất nhận xin vẽ khi chưa đủ điều kiện im lặng | 10 % | 0 đến 100 % |
| Chỉ nhận xin vẽ khi hàng chờ dưới (lượt) | `freeQueueLimit` | Chỉ nhận xin vẽ khi hàng chờ có ít hơn số lượt này | 3 | Số nguyên từ 0 đến 50 |
| Vẽ màu từ (xu) | `colorMinCoins` | Lượt có tổng xu từ mức này trở lên được vẽ màu | 99 xu | Số nguyên từ 1 trở lên |
| Thời gian vẽ (giây) | `drawSeconds` | Thời gian vẽ một bức | 45 giây | 5 đến 600 giây |
| Độ trễ sân khấu (giây) | `stageDelayMs` | Thời gian chờ sau quà gần nhất trước khi lượt được đưa lên sân khấu | 3 giây | 0 đến 60 giây |

Lưu ý: Các giá trị thời gian trong bảng có thể nhập số thập phân trên giao diện.

## Luật hàng chờ

- **Thứ tự**: lượt được ghim (đẩy lên đầu bằng nút ↑) đứng trước. Sau đó xếp theo số xu giảm dần; bằng xu thì ai vào trước được vẽ trước.
- **Gộp quà**: nếu cùng một người tặng thêm quà trong vòng "Gộp quà trong" kể từ quà gần nhất của họ, và lượt cũ vẫn đang chờ, thì số xu được cộng vào lượt cũ và hàng chờ được xếp lại. Quà đến sau khoảng này, hoặc khi người đó đang được vẽ, sẽ tạo lượt mới.
- **Độ trễ sân khấu**: một lượt chỉ được đưa lên vẽ khi đã đủ "Độ trễ sân khấu" kể từ quà gần nhất của lượt đó. Nếu lượt đứng đầu chưa đủ trễ, lượt đủ trễ phía sau sẽ được vẽ trước.
- **Xin vẽ không quà**: bình luận bắt đầu bằng từ khoá được nhận khi hàng chờ còn ngắn (dưới "Chỉ nhận xin vẽ khi hàng chờ dưới") và đạt một trong hai điều kiện: đã im lặng đủ "Nhận xin vẽ khi không có quà trong", hoặc trúng tỉ lệ ngẫu nhiên. Người đã có lượt đang chờ mà xin tiếp thì được bỏ qua. Người đang chờ dạng xin vẽ mà tặng quà thì lượt xin vẽ được thay bằng lượt quà.
- **Màu**: nếu tổng xu của lượt khi bắt đầu vẽ đạt "Vẽ màu từ", bức vẽ có màu; nếu thấp hơn, bức vẽ dùng một màu mực.

## Phím tắt

Phím tắt chỉ hoạt động khi đang có một bức đang vẽ, khi con trỏ không nằm trong ô nhập liệu, và không kèm Ctrl, Cmd hay Alt.

- **P**: tạm dừng hoặc tiếp tục bức đang vẽ.
- **S**: bỏ qua bức đang vẽ và chuyển sang lượt kế tiếp.

## Giới hạn và rủi ro

- Thư viện `tiktok-live-connector` (phiên bản 2.5.0) không phải API chính thức của TikTok. Thư viện có thể ngừng hoạt động hoặc lỗi bất cứ lúc nào khi TikTok thay đổi, và việc dùng nó có thể vi phạm điều khoản dịch vụ của TikTok.
- **Kết nối tới một phòng LIVE TikTok thật CHƯA được thử nghiệm.** Hiện chỉ chế độ Diễn tập đã được kiểm chứng.
- Máy chủ chỉ lắng nghe trên `127.0.0.1`, không mở cho máy khác trong mạng.
- Ứng dụng chỉ đọc sự kiện công khai của phòng. Không đăng nhập, không gửi tin nhắn hay bình luận thay bạn.
- Các tính năng chưa làm (xem mục 5.2 của đặc tả): điều khiển từ điện thoại; lưu lịch sử xuống đĩa; bảng quà trên sân khấu; nhiều kiểu khung; chế độ "khách đông"; theo dõi fan quay lại; sân khấu 3D; đóng gói thành bộ cài.

## Phát triển

Các lệnh kiểm tra:

```
npm test
npm run typecheck
```

- `npm test`: chạy bộ kiểm thử (Vitest).
- `npm run typecheck`: kiểm tra kiểu TypeScript, không tạo file.

Cấu trúc thư mục `src/`:

```
src/
  core/      logic thuần: cài đặt, luật nhận, hàng chờ, phiên làm việc, số liệu, nét vẽ
  sources/   nguồn sự kiện: tiktok.ts (nối TikTok LIVE) và simulator.ts (diễn tập)
  server/    máy chủ localhost (main.ts, app.ts), lưu cài đặt, tải ảnh đại diện
  client/    giao diện: control/ (bảng điều khiển), stage/ (sân khấu), protocol.ts
```
