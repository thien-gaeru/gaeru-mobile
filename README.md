# GAERU Mobile App (Android & iOS)

Ứng dụng di động chính thức của **GAERU** kết nối đồng bộ trực tiếp với website [gaeru.com](https://gaeru.com) và dịch vụ bảo hành **GAERU Care+**.

Dự án được xây dựng theo **Phương án Hybrid Native (Capacitor 8 + Node.js)** đáp ứng đầy đủ tiêu chuẩn kiểm duyệt của **Google Play Store** và **Apple App Store (Guideline 4.2 Minimum Functionality)**.

---

## 🌟 Các tính năng Native được tích hợp sẵn

1. **Kết nối thời gian thực với gaeru.com:** Tự động đồng bộ sản phẩm, giá bán, flash sale và giỏ hàng từ web mà không cần cập nhật app liên tục.
2. **Màn hình Ngoại tuyến (Offline Handling):** Tự động phát hiện khi mất kết nối mạng (Wi-Fi, 4G/5G), hiển thị giao diện thương hiệu GAERU chuyên nghiệp kèm nút gọi trực tiếp hotline **082 919 1080**.
3. **Quét mã QR / Barcode GAERU Care+:** Sử dụng camera của thiết bị để quét mã tem bảo hành hoặc serial trên hộp sản phẩm (micro K9, gimbal P01...) và chuyển thẳng vào trang tra cứu bảo hành.
4. **Hỗ trợ nút Back phần cứng Android:** Bấm Back để quay lại trang trước trong web, nhấn 2 lần để xác nhận thoát app (tránh trường hợp người dùng vô tình bấm nhầm bị thoát app đột ngột).
5. **Thông báo đẩy (Push Notifications):** Đã cấu hình sẵn bộ lắng nghe token thiết bị (APNs / FCM) để gửi thông báo khuyến mãi, đơn hàng.
6. **Tối ưu hiển thị Safe Area:** Tự động né tai thỏ (iPhone notch), Dynamic Island và thanh điều hướng ảo trên các dòng máy mới.

---

## 📁 Cấu trúc thư mục

```
gaeru-mobile/
├── android/                 # Dự án Android Studio (Gradle, Manifest, Java/Kotlin)
├── ios/                     # Dự án iOS Xcode (Swift, Info.plist)
├── www/                     # Web App Shell & Native Bridge
│   ├── index.html           # Giao diện chính, điều hướng, camera modal
│   ├── app.css              # Giao diện tối ưu di động theo màu thương hiệu GAERU
│   ├── app.js               # Logic điều khiển, lắng nghe sự kiện Native, quét mã
│   └── assets/brand/        # Logo và tài nguyên hình ảnh GAERU
├── scripts/
│   ├── build.js             # Kiểm tra tính toàn vẹn tài nguyên
│   └── generate-keystore.ps1 # Script tạo keystore ký bản phát hành Android
├── capacitor.config.json    # Cấu hình Capacitor (App ID, URL, Plugins)
└── package.json             # Các gói phụ thuộc Node.js
```

---

## 🚀 Hướng dẫn phát triển & Đóng gói ứng dụng

### 1. Đồng bộ mã nguồn sau khi chỉnh sửa
Mỗi khi bạn chỉnh sửa file trong thư mục `www/`, chạy lệnh sau để đồng bộ sang cả Android và iOS:
```bash
npm run cap:sync
```

---

### 2. Xuất bản ứng dụng Android (Google Play Store)

#### Bước 2.1: Mở dự án trong Android Studio
```bash
npm run cap:open:android
```

#### Bước 2.2: Tạo Keystore ký ứng dụng (Release Key)
Chạy script PowerShell được cung cấp sẵn:
```bash
npm run generate:keystore
```
Hoặc trong Android Studio: chọn **Build** -> **Generate Signed Bundle / APK...** -> chọn **Android App Bundle (.aab)** -> Chọn **Create new keystore**.

#### Bước 2.3: Build file `.aab` để đăng lên Google Play
* Trong Android Studio, chọn **Build** -> **Generate Signed Bundle / APK...**
* Chọn file keystore vừa tạo, nhập mật khẩu và chọn biến thể **release**.
* File `.aab` xuất ra sẽ được dùng để upload lên **Google Play Console** (mục *Production* hoặc *Closed Testing*).

---

### 3. Xuất bản ứng dụng iOS (Apple App Store)

> [!NOTE]
> Để build app iOS, bạn cần một máy Mac có cài đặt **Xcode** (hoặc dùng các dịch vụ CI/CD cloud như GitHub Actions / Codemagic).

#### Bước 3.1: Mở dự án trong Xcode
```bash
npm run cap:open:ios
```

#### Bước 3.2: Cấu hình tài khoản Apple Developer
* Trong Xcode, chọn project **App** ở cột trái -> tab **Signing & Capabilities**.
* Tích chọn **Automatically manage signing**.
* Chọn **Team** tương ứng với tài khoản Apple Developer của bạn.
* Bundle Identifier mặc định: `com.gaeru.store`.

#### Bước 3.3: Lưu trữ (Archive) và tải lên App Store Connect
* Chọn thiết bị đích là **Any iOS Device (arm64)**.
* Trên thanh menu chọn **Product** -> **Archive**.
* Khi quá trình hoàn tất, bấm **Distribute App** -> Chọn **App Store Connect** -> **Upload**.
* Truy cập trang **App Store Connect** để điền thông tin mô tả, ảnh chụp màn hình và gửi duyệt.

---

### 4. Cấu hình Thông báo đẩy (Firebase Cloud Messaging)

1. Truy cập [Firebase Console](https://console.firebase.google.com/) và tạo project mới tên `GAERU Mobile`.
2. **Đối với Android:** Thêm app Android với package `com.gaeru.store`, tải file `google-services.json` và đặt vào thư mục `android/app/`.
3. **Đối với iOS:** Thêm app iOS, tải file `GoogleService-Info.plist` và kéo vào Xcode trong nhóm thư mục `App`.
4. Khi đó, hàm `PushNotifications.register()` trong `app.js` sẽ tự động cấp mã token để bạn gửi thông báo đơn hàng hoặc sự kiện sale trực tiếp đến điện thoại khách hàng!
