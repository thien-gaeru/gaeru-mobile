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

// Chuyển đổi toàn bộ hình ảnh sang Base64 Data URI để hiển thị 100% không phụ thuộc mạng
function fileToBase64(relPath, mimeType) {
  try {
    const fullPath = path.join(WWW_DIR, relPath);
    if (fs.existsSync(fullPath)) {
      const b64 = fs.readFileSync(fullPath).toString('base64');
      return `data:${mimeType};base64,${b64}`;
    }
  } catch (e) {
    console.warn('Lỗi đọc ảnh:', relPath, e.message);
  }
  return '';
}

const logoWebpBase64 = fileToBase64('assets/brand/gaeru-logo.webp', 'image/webp');
const logoPngBase64 = fileToBase64('assets/brand/gaeru-logo.png', 'image/png');
const g1UltraBase64 = fileToBase64('assets/products/g1-ultra-clean.webp', 'image/webp');
const m3Base64 = fileToBase64('assets/products/m3.webp', 'image/webp');
const k9Base64 = fileToBase64('assets/products/k9.webp', 'image/webp');
const p01Base64 = fileToBase64('assets/products/p01.webp', 'image/webp');

const bundledImages = {
  'assets/brand/gaeru-logo.webp': logoWebpBase64,
  'assets/brand/gaeru-logo.png': logoPngBase64,
  'assets/products/g1-ultra-clean.webp': g1UltraBase64,
  'assets/products/m3.webp': m3Base64,
  'assets/products/k9.webp': k9Base64,
  'assets/products/p01.webp': p01Base64
};

let productsJson = '[]';
try {
  const raw = fs.readFileSync(path.join(WWW_DIR, 'data', 'products.json'), 'utf8');
  const parsed = JSON.parse(raw);
  productsJson = JSON.stringify(parsed.products || parsed);
} catch (e) {}

let provincesJson = '{"provinces":[]}';
try {
  const provPath = path.join(WWW_DIR, 'assets', 'data', 'vietnam-addresses.json');
  if (fs.existsSync(provPath)) {
    provincesJson = fs.readFileSync(provPath, 'utf8');
  }
} catch (e) {}

let guidesJson = '[]';
try {
  const guidesPath = path.join(WWW_DIR, 'data', 'guides.json');
  if (fs.existsSync(guidesPath)) {
    const raw = fs.readFileSync(guidesPath, 'utf8');
    const parsed = JSON.parse(raw);
    guidesJson = JSON.stringify(parsed.guides || parsed || []);
  }
} catch (e) {}

// Ghép nối HTML hoàn chỉnh bên trong iframe
let innerAppHtml = indexHtml;

// Thay thế trực tiếp các đường dẫn ảnh tĩnh trong HTML bằng Base64 Data URI
if (logoWebpBase64) {
  innerAppHtml = innerAppHtml.replace('src="assets/brand/gaeru-logo.webp"', `src="${logoWebpBase64}"`);
}
if (logoPngBase64) {
  innerAppHtml = innerAppHtml.replace("this.src='assets/brand/gaeru-logo.png'", `this.src='${logoPngBase64}'`);
}
if (g1UltraBase64) {
  innerAppHtml = innerAppHtml.replace('src="assets/products/g1-ultra-clean.webp"', `src="${g1UltraBase64}"`);
}

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

// 3. Nhúng dữ liệu sẵn có, ảnh Base64 và script xử lý
const inlinedJs = `
  <script>
    // Dữ liệu đóng gói sẵn phòng khi sandbox webview chặn kết nối mạng
    window.__BUNDLED_PRODUCTS__ = ${productsJson};
    window.__BUNDLED_PROVINCES__ = ${provincesJson};
    window.__BUNDLED_GUIDES__ = ${guidesJson};
    window.__BUNDLED_IMAGE_ASSETS__ = ${JSON.stringify(bundledImages)};
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
  <title>GAERU Mobile App — Live Simulator & Tương Tác Trực Quan</title>
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    /* Chống nhấp nháy trắng */
    iframe {
      background-color: #0b0f19 !important;
    }
  </style>
</head>
<body class="bg-[#0f172a] text-slate-100 antialiased p-3 sm:p-5 min-h-screen flex items-center justify-center">
  <div class="max-w-5xl w-full mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col lg:flex-row gap-6 items-center lg:items-start justify-center">
    
    <!-- Cột trái: Khung điện thoại di động mô phỏng (Phone Mockup) -->
    <div class="relative w-[360px] h-[720px] bg-[#0b0f19] rounded-[52px] p-3 shadow-2xl border-4 border-slate-700 ring-1 ring-white/10 flex flex-col flex-shrink-0">
      
      <!-- Loa thoại & Dynamic Island -->
      <div class="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-30 flex items-center justify-between px-3 pointer-events-none">
        <div class="w-2.5 h-2.5 bg-[#18181b] rounded-full"></div>
        <div class="w-2 h-2 bg-[#0284c7]/50 rounded-full"></div>
      </div>

      <!-- Màn hình cảm ứng: Iframe nhúng tự lực ĐÃ BỎ SANDBOX ĐỂ TƯƠNG TÁC 100% -->
      <div class="relative w-full h-full rounded-[42px] overflow-hidden bg-[#0b0f19] z-10 flex flex-col">
        <iframe id="phone-frame" class="w-full h-full border-0 bg-[#0b0f19]" allow="camera; microphone; geolocation; payment"></iframe>
      </div>

      <!-- Vạch Home Indicator dưới cùng -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/30 rounded-full z-30 pointer-events-none"></div>
    </div>

    <!-- Cột phải: Bảng điều khiển tương tác & Thông tin trực quan -->
    <div class="flex-1 flex flex-col gap-4 w-full">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <h2 class="text-base font-bold text-white">GAERU Mobile Native Simulator</h2>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">Tương tác trực tiếp & Hiển thị hình ảnh 100% tự lực</p>
        </div>
        <span class="text-xs font-mono px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-bold">LIVE DB 100%</span>
      </div>

      <!-- BỘ PHÍM TƯƠNG TÁC NHANH (QUICK INTERACTION CONTROLS) -->
      <div class="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl space-y-2.5">
        <div class="flex items-center justify-between">
          <strong class="text-xs text-sky-400 font-bold uppercase tracking-wider">🎮 Phím Điều Khiển Thử Nghiệm Nhanh</strong>
          <span class="text-[11px] text-slate-400">Chạm màn hình hoặc bấm nút dưới</span>
        </div>

        <!-- Chuyển 4 Tab -->
        <div class="grid grid-cols-4 gap-1.5">
          <button class="px-2 py-2 text-xs bg-slate-700/80 hover:bg-slate-600 rounded-lg font-medium transition text-center" onclick="simSwitchTab('tab-home')">
            🏠 Trang chủ
          </button>
          <button class="px-2 py-2 text-xs bg-slate-700/80 hover:bg-slate-600 rounded-lg font-medium transition text-center" onclick="simSwitchTab('tab-products')">
            🛍️ Sản phẩm
          </button>
          <button class="px-2 py-2 text-xs bg-slate-700/80 hover:bg-slate-600 rounded-lg font-medium transition text-center" onclick="simSwitchTab('tab-care')">
            🛡️ Bảo hành
          </button>
          <button class="px-2 py-2 text-xs bg-slate-700/80 hover:bg-slate-600 rounded-lg font-medium transition text-center" onclick="simSwitchTab('tab-account')">
            👤 Tài khoản
          </button>
        </div>

        <!-- Thao tác thử nghiệm đặt hàng, tra cứu & đồng bộ -->
        <div class="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/60">
          <button class="px-2 py-2 text-xs bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg font-semibold transition flex items-center justify-center gap-1 shadow" onclick="simOpenOrder('gaeru-g1-ultra')">
            ⚡ Đặt hàng G1
          </button>
          <button class="px-2 py-2 text-xs bg-sky-600/90 hover:bg-sky-500 text-white rounded-lg font-semibold transition flex items-center justify-center gap-1 shadow" onclick="simTestCare('GR-20261105-0404344DB3')">
            🔍 Tra cứu BH
          </button>
          <button class="px-2 py-2 text-xs bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-lg font-semibold transition flex items-center justify-center gap-1 shadow" onclick="simSyncWeb()">
            🔄 Đồng bộ Web
          </button>
        </div>
      </div>

      <!-- Bộ điều khiển thử nghiệm Giao diện Sáng / Tối trực tiếp -->
      <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
        <div>
          <strong class="text-xs text-white block font-semibold">Chế độ Màu (Dark / Light Theme)</strong>
          <span class="text-[11px] text-slate-400">Tự động theo điện thoại hoặc đổi thủ công</span>
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

      <!-- Các tính năng CSDL & Phản hồi trực quan -->
      <div class="space-y-2 text-xs">
        <div class="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2.5">
          <span class="text-base">🗄️</span>
          <div>
            <strong class="text-emerald-400 block font-bold">Đặt Hàng Trực Quan Kèm Mã Đơn Realtime</strong>
            <span class="text-slate-400">Khi bấm "Xác nhận đặt hàng", hệ thống kiểm tra số điện thoại (10 số), địa chỉ, cấp mã đơn thực tế từ CSDL và bật hộp thoại chi tiết có nút sao chép mã.</span>
          </div>
        </div>

        <div class="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5">
          <span class="text-base">🛡️</span>
          <div>
            <strong class="text-blue-400 block font-bold">Tra Cứu Care+ Báo Lỗi / Thành Công Rõ Ràng</strong>
            <span class="text-slate-400">Nhập mã đơn <code>GR-20261105-0404344DB3</code> để kiểm tra phản hồi thành công; hoặc nhập mã giả để kiểm tra thông báo lỗi cụ thể.</span>
          </div>
        </div>

        <div class="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
          <span class="text-base">🖼️</span>
          <div>
            <strong class="text-amber-400 block font-bold">Đóng Gói Ảnh Base64 Tự Lực (Zero Missing Image)</strong>
            <span class="text-slate-400">Logo và ảnh sản phẩm (G1 Ultra, M3, K9, P01) được nhúng sẵn dưới dạng Data URI, hiển thị sắc nét trong mọi môi trường.</span>
          </div>
        </div>
      </div>

      <!-- Các đường dẫn mở trực tiếp để kiểm tra -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800">
        <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between">
          <div>
            <div class="text-[11px] font-medium text-slate-400">Mở toàn màn hình:</div>
            <a href="http://localhost:5000" target="_blank" class="text-xs font-mono text-blue-400 hover:underline font-semibold">
              http://localhost:5000 ↗
            </a>
          </div>
          <a href="http://localhost:5000" target="_blank" class="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition shadow">
            Mở tab
          </a>
        </div>

        <div class="p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl">
          <div class="text-[11px] font-medium text-slate-400">Điện thoại thật (Wi-Fi):</div>
          <div class="text-xs font-mono text-emerald-400 font-semibold select-all mt-0.5">
            http://192.168.31.79:5000
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // Dữ liệu ứng dụng hoàn chỉnh được nhúng an toàn, escape toàn bộ '<' để parser HTML không ngắt script
    const INLINED_APP_HTML = ${JSON.stringify(innerAppHtml).replace(/</g, '\\u003c')};

    const frame = document.getElementById('phone-frame');

    function renderIframeApp() {
      if (!frame) return;
      try {
        frame.srcdoc = INLINED_APP_HTML;
      } catch (e) {
        console.warn('srcdoc assign error:', e);
      }

      // Đảm bảo tuyệt đối không trắng màn hình: Fallback sau 200ms
      setTimeout(() => {
        try {
          const doc = frame.contentDocument || (frame.contentWindow ? frame.contentWindow.document : null);
          if (doc && (!doc.body || !doc.body.children || doc.body.children.length === 0)) {
            doc.open();
            doc.write(INLINED_APP_HTML);
            doc.close();
          }
        } catch (err) {
          console.warn('Fallback render error:', err);
        }
      }, 200);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderIframeApp);
    } else {
      renderIframeApp();
    }

    function getFrameWin() {
      if (!frame) return null;
      return frame.contentWindow || (frame.contentDocument ? frame.contentDocument.defaultView : null);
    }

    function simSwitchTab(tabId) {
      const win = getFrameWin();
      if (win && win.switchTab) {
        win.switchTab(tabId);
      }
    }

    function simOpenOrder(slug) {
      const win = getFrameWin();
      if (win && win.openInstantOrder) {
        win.openInstantOrder(slug);
      }
    }

    function simTestCare(code) {
      const win = getFrameWin();
      if (win) {
        if (win.switchTab) win.switchTab('tab-care');
        setTimeout(() => {
          const doc = win.document;
          const input = doc.getElementById('care-serial-input');
          const btn = doc.getElementById('btn-check-care');
          if (input && btn) {
            input.value = code;
            btn.click();
          }
        }, 150);
      }
    }

    function simSyncWeb() {
      const win = getFrameWin();
      if (win && win.syncAllLiveContent) {
        win.syncAllLiveContent();
      }
    }

    function setFrameTheme(theme) {
      const win = getFrameWin();
      if (win) {
        win.postMessage({ type: 'GAERU_SET_THEME', theme: theme }, '*');
        try {
          const doc = win.document;
          if (doc && doc.documentElement) {
            doc.documentElement.setAttribute('data-theme', theme);
            if (win.SafeStorage) {
              win.SafeStorage.setItem('gaeru_theme_preference', theme);
            }
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
