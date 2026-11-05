const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const WWW_DIR = path.join(ROOT_DIR, 'www');
const ARTIFACT_PATH = 'C:/Users/imdot/.gemini/antigravity/brain/c4e9aeed-481a-4751-8ce6-25df8c7733fa/gaeru-mobile-preview.html';

console.log('--- Đang đóng gói bản xem trước tự lực (Standalone Preview Generator) ---');

// Đọc các tệp tin tài nguyên
const indexHtml = fs.readFileSync(path.join(WWW_DIR, 'index.html'), 'utf8');
const brandCss = fs.readFileSync(path.join(WWW_DIR, 'brand.css'), 'utf8');
const appCss = fs.readFileSync(path.join(WWW_DIR, 'app.css'), 'utf8');
const apiClientJs = fs.readFileSync(path.join(WWW_DIR, 'api-client.js'), 'utf8');
const appJs = fs.readFileSync(path.join(WWW_DIR, 'app.js'), 'utf8');

let productsJson = '[]';
try {
  const raw = fs.readFileSync(path.join(WWW_DIR, 'data', 'products.json'), 'utf8');
  const parsed = JSON.parse(raw);
  productsJson = JSON.stringify(parsed.products || parsed);
} catch (e) {}

let provincesJson = '[]';
try {
  provincesJson = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'data', 'vietnam-addresses.json'), 'utf8');
} catch (e) {}

// Ghép nối HTML hoàn chỉnh bên trong iframe
let innerAppHtml = indexHtml;

// 1. Thêm thẻ base để các ảnh assets tải trực tiếp từ https://gaeru.com
innerAppHtml = innerAppHtml.replace('<head>', `<head>\n  <base href="https://gaeru.com/">`);

// 2. Nhúng trực tiếp toàn bộ CSS vào <style>
const inlinedCss = `
  <style>
    /* CSS Thương hiệu GAERU */
    ${brandCss}
    
    /* CSS Ứng dụng GAERU Mobile */
    ${appCss}
  </style>
`;
innerAppHtml = innerAppHtml.replace('<link rel="stylesheet" href="brand.css">', inlinedCss);
innerAppHtml = innerAppHtml.replace('<link rel="stylesheet" href="app.css">', '');

// 3. Nhúng dữ liệu sẵn có và script xử lý
const inlinedJs = `
  <script>
    // Dữ liệu đóng gói sẵn phòng khi sandbox webview chặn kết nối mạng
    window.__BUNDLED_PRODUCTS__ = ${productsJson};
    window.__BUNDLED_PROVINCES__ = ${provincesJson};
  </script>
  <script>
    ${apiClientJs}
  </script>
  <script>
    ${appJs}
  </script>
`;

innerAppHtml = innerAppHtml.replace('<script src="api-client.js"></script>', inlinedJs);
innerAppHtml = innerAppHtml.replace('<script src="app.js"></script>', '');

// Hàm escape thuộc tính HTML để nhúng an toàn vào srcdoc
function escapeHtmlAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// Tạo trang Simulator cha
const previewSimulatorHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GAERU Mobile App — Live Simulator (Chống lỗi trắng màn hình)</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    /* Chống nhấp nháy trắng */
    iframe {
      background-color: #0b0f19 !important;
    }
  </style>
</head>
<body class="bg-[#0f172a] text-slate-100 antialiased p-3 sm:p-5 min-h-screen flex items-center justify-center">
  <div class="max-w-4xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col md:flex-row gap-6 items-center md:items-start justify-center">
    
    <!-- Cột trái: Khung điện thoại di động mô phỏng (Phone Mockup) -->
    <div class="relative w-[360px] h-[720px] bg-[#0b0f19] rounded-[52px] p-3 shadow-2xl border-4 border-slate-700 ring-1 ring-white/10 flex flex-col flex-shrink-0">
      
      <!-- Loa thoại & Dynamic Island -->
      <div class="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-30 flex items-center justify-between px-3 pointer-events-none">
        <div class="w-2.5 h-2.5 bg-[#18181b] rounded-full"></div>
        <div class="w-2 h-2 bg-[#0284c7]/50 rounded-full"></div>
      </div>

      <!-- Màn hình cảm ứng (Iframe nhúng tự lực với srcdoc kép chống lỗi trắng màn hình) -->
      <div class="relative w-full h-full rounded-[42px] overflow-hidden bg-[#0b0f19] z-10 flex flex-col">
        <iframe id="phone-frame" srcdoc="${escapeHtmlAttr(innerAppHtml)}" class="w-full h-full border-0 bg-[#0b0f19]" allow="camera; microphone; geolocation; payment" sandbox="allow-scripts allow-forms allow-same-origin allow-modals"></iframe>
      </div>

      <!-- Vạch Home Indicator dưới cùng -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full z-30 pointer-events-none"></div>
    </div>

    <!-- Cột phải: Thông tin máy chủ sống & Bảng điều khiển -->
    <div class="flex-1 flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <h2 class="text-base font-bold text-white">GAERU Mobile Native Simulator</h2>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Bản dựng tự động nhúng toàn vẹn (Zero-Blank Screen)</p>
        </div>
        <span class="text-xs font-mono px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-bold">LIVE DB 100%</span>
      </div>

      <!-- Bộ điều khiển thử nghiệm Giao diện Sáng / Tối trực tiếp -->
      <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
        <div>
          <strong class="text-xs text-white block font-semibold">Chuyển đổi Chế độ Màu (Theme)</strong>
          <span class="text-[11px] text-slate-400">Thử nghiệm Dark Mode & Light Mode</span>
        </div>
        <div class="flex gap-2">
          <button id="btn-sim-dark" class="px-3 py-1.5 text-xs bg-slate-700 text-white border border-slate-600 rounded-lg hover:bg-slate-600 font-medium transition flex items-center gap-1.5" onclick="setFrameTheme('dark')">
            <span>🌙</span> Tối
          </button>
          <button id="btn-sim-light" class="px-3 py-1.5 text-xs bg-slate-200 text-slate-900 border border-slate-300 rounded-lg hover:bg-white font-medium transition flex items-center gap-1.5" onclick="setFrameTheme('light')">
            <span>☀️</span> Sáng
          </button>
        </div>
      </div>

      <!-- Các tính năng CSDL nổi bật -->
      <div class="space-y-2 text-xs">
        <div class="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
          <span class="text-base">🗄️</span>
          <div>
            <strong class="text-emerald-400 block font-bold">Kết Nối Trực Tiếp CSDL Bảng <code>orders</code></strong>
            <span class="text-slate-400">Đơn hàng gửi lên được cấp mã thực tế từ PostgreSQL <code>#GR-...</code>. Tra cứu trạng thái đơn thời gian thực từ CSDL máy chủ.</span>
          </div>
        </div>

        <div class="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
          <span class="text-base">👤</span>
          <div>
            <strong class="text-blue-400 block font-bold">Xác Thực Bảng <code>customers</code> & Sổ Địa Chỉ</strong>
            <span class="text-slate-400">Chạm tab <strong>Tài khoản</strong> để Đăng nhập / Đăng ký trực tiếp vào CSDL gaeru.com, tải lịch sử đơn hàng và sổ địa chỉ.</span>
          </div>
        </div>

        <div class="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
          <span class="text-base">🛡️</span>
          <div>
            <strong class="text-amber-400 block font-bold">Tra Cứu Bảo Hành Care+ Thật 100%</strong>
            <span class="text-slate-400">Loại bỏ hoàn toàn dữ liệu cứng mẫu. Người dùng nhập mã đơn (ví dụ: <code>GR-20261105-0404344DB3</code>) sẽ đối soát chuẩn xác trên database.</span>
          </div>
        </div>
      </div>

      <!-- Các đường dẫn mở trực tiếp để kiểm tra -->
      <div class="grid grid-cols-1 gap-2 pt-2 border-t border-slate-800">
        <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-400">Mở toàn màn hình trình duyệt:</div>
            <a href="http://localhost:5000" target="_blank" class="text-sm font-mono text-blue-400 hover:underline font-semibold">
              http://localhost:5000 ↗
            </a>
          </div>
          <a href="http://localhost:5000" target="_blank" class="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow-md">
            Mở tab mới
          </a>
        </div>

        <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
          <div class="text-xs font-medium text-slate-400">Xem trên điện thoại thật (cùng Wi-Fi):</div>
          <div class="text-sm font-mono text-emerald-400 font-semibold select-all mt-0.5">
            http://192.168.31.79:5000
          </div>
        </div>
      </div>

      <div class="text-[11px] text-slate-500 text-center">
        Kiểm tra CSDL độc lập: <code class="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">npm run test:db</code>
      </div>
    </div>
  </div>

  <script>
    // Dữ liệu ứng dụng hoàn chỉnh được nhúng an toàn, escape toàn bộ '<' để parser HTML không ngắt script
    const INLINED_APP_HTML = ${JSON.stringify(innerAppHtml).replace(/</g, '\\u003c')};

    const frame = document.getElementById('phone-frame');
    if (frame && (!frame.srcdoc || frame.srcdoc === 'about:blank')) {
      frame.srcdoc = INLINED_APP_HTML;
    }

    function setFrameTheme(theme) {
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: 'GAERU_SET_THEME', theme: theme }, '*');
        try {
          const doc = frame.contentDocument || frame.contentWindow.document;
          if (doc && doc.documentElement) {
            doc.documentElement.setAttribute('data-theme', theme);
            frame.contentWindow.localStorage.setItem('gaeru_theme_preference', theme);
          }
        } catch (e) {
          console.warn('Frame theme set:', e);
        }
      }
    }
  </script>
</body>
</html>`;

fs.writeFileSync(ARTIFACT_PATH, previewSimulatorHtml, 'utf8');
console.log('✅ Đã đóng gói thành công bản xem trước tự lực vào:', ARTIFACT_PATH);
