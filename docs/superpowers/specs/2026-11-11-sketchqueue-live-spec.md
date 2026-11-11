# SketchQueue LIVE — Phân tích ứng dụng gốc và đặc tả bản làm lại

Ngày: 2026-11-11. Nguồn bằng chứng duy nhất: **một ảnh chụp màn hình bằng điện thoại** của ứng dụng gốc đang chạy trên Windows. Không có file cài đặt, không có mã, không có capture mạng.

Theo quy tắc của REA (`reverse-engineer-anything/SKILL.md`), mọi kết luận được chia ba loại: **Quan sát**, **Suy luận**, **Chưa biết**. REA chưa được áp dụng vì (a) không có artifact để mở, (b) phiên làm việc này không có công cụ REA MCP. Xem mục 4 để biết cách nâng suy luận thành bằng chứng.

## 1. Quan sát (đọc được trực tiếp trên ảnh)

**Cửa sổ:** một cửa sổ Windows thường, chia hai nửa.

**Nửa trái — sân khấu (nền sáng):**
- Mô hình máy vẽ dạng dựng 3D: thanh ray ngang, đầu bút, khối gỗ, một trục cuộn giấy ở phía dưới.
- Trên giấy là một ảnh tròn, nét mực xanh kiểu bán sắc, nằm trong khung trang trí; bên dưới ghi `@<tên tài khoản>`.
- Cột "UP NEXT" liệt kê 3 người (số thứ tự, ảnh đại diện, tên bị cắt ngắn bằng dấu ba chấm).
- Một hộp đỏ thông báo bằng tiếng Anh, đề nghị người xem tạm ngừng tặng quà vì hàng chờ đang dài.

**Nửa phải — bảng điều khiển (nền tối):**
- Hàng đầu: tên chủ phòng, các nút Kết nối / Diễn tập / Dữ liệu thật / Ngắt, nhãn LIVE màu xanh, dòng `room_id=<số dài>`.
- Hai hộp chọn: một preset tốc độ ("Vừa …") và một kiểu khung ("Guilloche (sóng)"); một nút "Khách đông".
- Các nút bật/tắt: bỏ hộp ngưng tặng quà, hiện bảng quà, "Sắp in (đang hiện)", Sân khấu, Cửa sổ riêng, Điện thoại, Cài đặt, Về mặc định, Lịch sử.
- Mười ô số liệu: người xem (150), thời gian live, xu buổi này, lượt quà, người tặng, fan mới, fan quay lại, bức đã vẽ, đang chờ (3), "nợ in sau"; kèm dòng top người tặng.
- Khung BÌNH LUẬN: dòng "đã tham gia", dòng quà ("1 Rose 1 xu"), các bình luận có giờ, ảnh đại diện, tên hiển thị, `@handle`.
- Khung ĐANG VẼ: nội dung, `@handle`, "không quà · chờ 0s", nút Tạm dừng (P), Bỏ qua (S), Vẽ lại lượt trước.
- Khung HÀNG CHỜ (3): nút Tự nhập, Xoá hết; mỗi dòng có nút đẩy lên (↑) và xoá (×), ghi tên quà và số xu.
- Hàng thử nghiệm: ô "Người thử", chọn quà, số lượng, nút Tặng thử, Bình luận thử, Thả 10 tim thử.
- Thanh trạng thái: đang chờ, đã vẽ, xu, quà, bình luận, "xin vẽ không quà: 1 (từ chối 0)", tim, "Avatar: tải 1, cache 0, lỗi 0".

**Thanh tác vụ:** biểu tượng của cửa sổ đang hoạt động trông giống logo Python.

## 2. Suy luận (chưa có bằng chứng trực tiếp)

| Suy luận | Căn cứ | Độ tin |
|---|---|---|
| Đây là công cụ cho chủ phòng TikTok LIVE: người xem tặng quà → ảnh đại diện của họ được "máy vẽ ảo" vẽ lại trên sóng | `room_id`, quà "Rose", đơn vị "xu", chuỗi sự kiện join/quà/bình luận/tim | Cao |
| Dữ liệu LIVE lấy qua thư viện không chính thức (họ `TikTokLive` / `tiktok-live-connector`), không phải API chính thức | Chỉ cần tên tài khoản là kết nối; có `room_id`; các loại sự kiện trùng với thư viện này | Trung bình |
| Viết bằng Python, giao diện là HTML trong webview (pywebview hoặc Qt WebEngine) | Biểu tượng Python; nút bo tròn, emoji, bố cục kiểu CSS | Thấp–trung bình |
| Sân khấu được thiết kế để OBS/TikTok Live Studio quay lại | Có nút "Cửa sổ riêng" và "Sân khấu" | Trung bình |
| "Diễn tập" chạy bằng dữ liệu giả, "Dữ liệu thật" chuyển sang nguồn thật | Tên nút và hàng nút thử | Cao |
| "Nợ in sau" đếm các lượt quà chưa được vẽ khi hàng chờ đầy hoặc đang ngưng nhận | Tên ô, hộp đỏ xin ngừng tặng | Thấp |
| "Điện thoại" mở trang điều khiển từ xa trong mạng nội bộ | Tên nút | Thấp |

## 3. Chưa biết về ứng dụng gốc — và quyết định của chủ dự án (2026-11-11)

Hành vi thật của ứng dụng gốc ở các điểm dưới đây vẫn **chưa biết**. Chủ dự án đã quyết định bản làm lại sẽ hoạt động như sau; mục 5.3 ghi giá trị cụ thể.

1. **Quà:** 1 hoa hồng (1 xu) là đủ. Quà giá trị cao hơn được vẽ trước. Một người tặng nhiều lần trong một khoảng ngắn (khoảng 1 phút, chỉnh được) thì cộng dồn thành một lượt.
2. **Xin vẽ không quà:** được nhận khi đã lâu không ai tặng quà (khoảng thời gian chỉnh được), hoặc theo tỉ lệ ngẫu nhiên khi hàng chờ đang ngắn.
3. **Nét vẽ:** quà đạt một ngưỡng giá trị (chỉnh được) thì vẽ màu, thấp hơn thì vẽ một màu mực. Thời gian vẽ chỉnh được.
4. **Sân khấu:** có độ trễ sau khi nhận quà rồi mới đưa lên sân khấu, để giảm tải cho máy.
5. **Cách chạy:** ứng dụng chạy trên localhost (mở bằng trình duyệt) và nhận đường link TikTok của tài khoản để nối vào phiên live của tài khoản đó.

Vẫn chưa biết và không ảnh hưởng tới bản làm lại: sân khấu 3D của ứng dụng gốc là thời gian thực hay dựng sẵn; ứng dụng gốc lưu dữ liệu ở định dạng nào.

## 4. Cách dùng REA để xác nhận (khi có artifact)

Nếu có file `.exe`/bộ cài của ứng dụng gốc và bạn có quyền phân tích nó:
1. `inspect_pe_resources` + `open_binary` → xác định trình đóng gói (PyInstaller, Nuitka, Electron…).
2. Nếu là Electron/ASAR: `analyze_javascript_application` với `detail: "summary"`. Nếu là Python đóng gói: giải nén rồi xem danh sách module để biết thư viện LIVE và webview.
3. Chụp HAR khi ứng dụng kết nối → `inspect_web_network_capture` để biết máy chủ ký và điểm cuối.

Bản làm lại dưới đây **không phụ thuộc** vào các bước này; nó chỉ dựa trên hành vi quan sát được.

## 5. Đặc tả bản làm lại: SketchQueue LIVE

Mục tiêu là một ứng dụng **khác, tương tự về chức năng**: tên riêng, giao diện riêng, mã viết mới. Không dùng lại tên sản phẩm, tên preset, hay tài khoản người xem thật trong ảnh.

### 5.1 Phạm vi MVP

1. **Nguồn sự kiện** có hai loại sau cùng một giao diện: bộ giả lập (diễn tập + các nút thử) và bộ nối TikTok LIVE thật.
2. **Hàng chờ vẽ**: thêm, gộp, đẩy lên đầu, xoá, xoá hết, thêm thủ công.
3. **Luật nhận yêu cầu** (mục 5.3).
4. **Số liệu buổi live**: người xem, xu, lượt quà, người tặng, fan mới, tim, bình luận, đã vẽ, đang chờ, nợ, từ chối, top người tặng.
5. **Sân khấu**: canvas 2D vẽ dần chân dung dạng nét sóng trong khung tròn, đầu bút chạy theo nét, chú thích `@handle`, cột "Tiếp theo" 3 người, hộp thông báo khi ngưng nhận quà.
6. **Bảng điều khiển**: kết nối/diễn tập/ngắt, tốc độ, tạm dừng/bỏ qua/vẽ lại, hàng chờ, khung sự kiện, số liệu, hàng thử.
7. Hai trang web trên localhost: bảng điều khiển và sân khấu (sân khấu để phần mềm phát sóng quay lại).
8. Trang Cài đặt cho mọi tham số ở mục 5.3, lưu xuống `settings.json`.

### 5.2 Ngoài phạm vi MVP (mỗi mục là một kế hoạch riêng sau này)

Điều khiển từ điện thoại; lưu lịch sử xuống đĩa; bảng quà trên sân khấu; nhiều kiểu khung; chế độ "khách đông"; fan quay lại; sân khấu 3D; đóng gói bộ cài.

### 5.3 Luật nghiệp vụ

Cột "Nguồn": **CDA** = chủ dự án quyết định; **TK** = người viết kế hoạch tự chọn để lấp chỗ trống, chủ dự án có thể đổi. Mọi dòng có tên cài đặt đều chỉnh được trong trang Cài đặt và được lưu xuống đĩa.

| Luật | Giá trị mặc định | Cài đặt | Nguồn |
|---|---|---|---|
| Ngưỡng quà được vẽ | 1 xu | `minCoins` | CDA |
| Quà dạng chuỗi (combo) | Chỉ tính khi chuỗi kết thúc; xu = xu một quà × số lần | — | TK |
| Thứ tự hàng chờ | Lượt được ghim trước, rồi xu giảm dần, bằng xu thì ai vào trước vẽ trước | — | CDA (ghim: TK) |
| Gộp quà của cùng một người | Quà mới đến trong vòng 60 s kể từ quà gần nhất của người đó, khi lượt còn đang chờ → cộng xu vào lượt cũ và xếp lại theo tổng xu | `combineWindowMs` | CDA |
| Quà đến sau cửa sổ gộp, hoặc khi người đó đang được vẽ | Tạo lượt mới | — | TK |
| Người đang chờ dạng "xin miễn phí" rồi tặng quà | Lượt miễn phí bị thay bằng lượt quà | — | TK |
| Sức chứa hàng chờ | 50 lượt; vượt quá → cộng 1 vào "nợ" (gộp vào lượt có sẵn thì vẫn được) | `maxQueue` | TK |
| Đang ngưng nhận quà | Quà vẫn tính vào số liệu, cộng 1 vào "nợ", không vào hàng chờ | `acceptingGifts` | TK |
| Từ khoá xin vẽ không quà | Bình luận là `!ve` hoặc bắt đầu bằng `!ve ` (không phân biệt hoa thường) | `freeKeyword` | TK |
| Nhận xin miễn phí — điều kiện chung | Hàng chờ có < 3 lượt; từ 3 lượt trở lên thì từ chối | `freeQueueLimit` | TK |
| Nhận xin miễn phí — điều kiện A | Đã ≥ 120 s không có quà nào (tính từ quà gần nhất, hoặc từ lúc mở ứng dụng nếu chưa có quà) | `freeIdleMs` | CDA (con số: TK) |
| Nhận xin miễn phí — điều kiện B | Không đạt A nhưng trúng tỉ lệ ngẫu nhiên 10 % | `freeChance` | CDA (cách diễn giải và con số: TK) |
| Xin miễn phí còn lại | Tính là từ chối. Người đã có lượt đang chờ mà xin tiếp → bỏ qua, không tính từ chối | `allowFreeRequests` | TK |
| Vẽ màu | Lượt có tổng xu ≥ 99 → mỗi nét lấy màu trung bình của ảnh tại nét đó; thấp hơn → một màu mực | `colorMinCoins` | CDA (con số: TK) |
| Thời gian vẽ một bức | 45 s (cho phép 5–600 s) | `drawSeconds` | CDA (con số: TK) |
| Độ trễ sân khấu | Một lượt chỉ được đưa lên vẽ khi đã ≥ 3 s kể từ quà gần nhất của lượt đó. Lượt xếp trên chưa đủ trễ thì lượt đủ trễ xếp dưới được vẽ trước. Trạng thái gửi tới trình duyệt tối đa 4 lần mỗi giây | `stageDelayMs` | CDA (cách diễn giải và con số: TK) |
| Chờ ảnh | Thời gian vẽ chỉ bắt đầu tính khi ảnh đã tải xong hoặc đã chuyển sang ảnh thay thế | — | TK |
| Ảnh đại diện lỗi/không có | Sau 8 s hoặc khi lỗi: vẽ ảnh thay thế có chữ cái đầu của tên | — | TK |
| Tên hiển thị trên sân khấu | Tối đa 14 ký tự (đếm theo grapheme), dài hơn thì cắt và thêm `…` | — | TK |
| Bỏ qua khi đang vẽ | Bức đó không tính vào "đã vẽ"; chuyển sang lượt kế | — | TK |
| Xoá hết khi đang vẽ | Chỉ xoá các lượt đang chờ; bức đang vẽ tiếp tục | — | TK |
| Mất kết nối | Hàng chờ, bức đang vẽ và số liệu giữ nguyên; nối lại không đặt lại số liệu | — | TK |
| Cách chạy | Máy chủ nhỏ chỉ nghe trên `127.0.0.1:4780`; `/` là bảng điều khiển, `/stage` là sân khấu (dùng làm Browser Source trong OBS) | — | CDA (cổng: TK) |
| Đầu vào kết nối | Nhận `@ten`, `ten`, `https://www.tiktok.com/@ten`, `https://www.tiktok.com/@ten/live` (có hay không có tham số). Link rút gọn `vm.tiktok.com` / `vt.tiktok.com` không được hỗ trợ và báo lỗi rõ ràng | — | CDA (giới hạn link rút gọn: TK) |

### 5.4 Rủi ro

Thư viện nối TikTok LIVE (`tiktok-live-connector` 2.5.0) là **không chính thức**, nhờ máy chủ của bên thứ ba (Euler Stream) ký kết nối nên bên đó biết tên tài khoản được nối và có thể giới hạn tần suất; có thể vi phạm điều khoản dịch vụ của TikTok và có thể ngừng hoạt động bất cứ lúc nào. Ứng dụng chỉ đọc sự kiện công khai của phòng, không đăng nhập, không gửi tin nhắn. Vì rủi ro này, bộ nối thật là nhiệm vụ cuối cùng và toàn bộ phần còn lại chạy được bằng bộ giả lập.
