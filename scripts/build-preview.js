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
const m3HomeCutoutBase64 = fileToBase64('assets/products/m3-home-cutout.webp', 'image/webp');
const m3Base64 = fileToBase64('assets/products/m3.webp', 'image/webp');
const k9Base64 = fileToBase64('assets/products/k9.webp', 'image/webp');
const p01Base64 = fileToBase64('assets/products/p01.webp', 'image/webp');
const p185CutoutBase64 = fileToBase64('assets/products/p185-cutout-1cc9dfde9fa3.webp', 'image/webp');
const g1UltraCleanBase64 = fileToBase64('assets/products/g1-ultra-clean.webp', 'image/webp');
const g1UltraBase64 = fileToBase64('assets/products/g1-ultra-874bf1d3db77.webp', 'image/webp');

const bundledImages = {
  'assets/brand/gaeru-logo.webp': logoWebpBase64,
  'assets/brand/gaeru-logo.png': logoPngBase64,
  'assets/products/m3-home-cutout.webp': m3HomeCutoutBase64,
  'assets/products/m3.webp': m3Base64,
  'assets/products/k9.webp': k9Base64,
  'assets/products/p01.webp': p01Base64,
  'assets/products/p185-cutout-1cc9dfde9fa3.webp': p185CutoutBase64,
  'assets/products/g1-ultra-clean.webp': g1UltraCleanBase64,
  'assets/products/g1-ultra-874bf1d3db77.webp': g1UltraBase64
};

// Đóng gói thêm các hình ảnh chi tiết M3
for (const n of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12]) {
  const rel = `assets/products/m3-description/${n}.webp`;
  const b64 = fileToBase64(rel, 'image/webp');
  if (b64) bundledImages[rel] = b64;
}

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
  innerAppHtml = innerAppHtml.split('src="assets/brand/gaeru-logo.webp"').join(`src="${logoWebpBase64}"`);
}
if (logoPngBase64) {
  innerAppHtml = innerAppHtml.split("this.src='assets/brand/gaeru-logo.png'").join(`this.src='${logoPngBase64}'`);
}
if (g1UltraCleanBase64) {
  innerAppHtml = innerAppHtml.split('src="assets/products/g1-ultra-clean.webp"').join(`src="${g1UltraCleanBase64}"`);
}
if (m3HomeCutoutBase64) {
  innerAppHtml = innerAppHtml.split('src="assets/products/m3-home-cutout.webp"').join(`src="${m3HomeCutoutBase64}"`);
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
        <div class="flex items-center gap-2">
          <button id="btn-mode-live" onclick="switchToLiveMode()" class="px-2.5 py-1 text-xs bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-md font-semibold transition flex items-center gap-1 shadow">
            <span class="inline-block w-2 h-2 bg-white rounded-full animate-pulse"></span>
            <span>Chế độ Live</span>
          </button>
          <button id="btn-mode-offline" onclick="switchToOfflineMode()" class="px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md font-medium transition flex items-center gap-1">
            <span>📦 Tự lực</span>
          </button>
          <button onclick="reloadSimulatorFrame()" class="p-1.5 text-slate-400 hover:text-white rounded-md bg-slate-800 border border-slate-700" title="Tải lại màn hình">
            🔄
          </button>
        </div>
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
    const LIVE_URL = 'http://localhost:5000';
    let currentMode = 'live'; // 'live' | 'offline'

    const frame = document.getElementById('phone-frame');
    const btnLive = document.getElementById('btn-mode-live');
    const btnOffline = document.getElementById('btn-mode-offline');

    async function switchToLiveMode() {
      currentMode = 'live';
      if (btnLive) {
        btnLive.className = 'px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold transition flex items-center gap-1 shadow ring-2 ring-emerald-400/50';
      }
      if (btnOffline) {
        btnOffline.className = 'px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-md font-medium transition flex items-center gap-1';
      }

      try {
        // Kiểm tra Live Server đang chạy ở cổng 5000
        const res = await fetch(LIVE_URL + '/api/realtime/health', { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          console.log('🟢 Đang kết nối trực tiếp Live Server: ' + LIVE_URL);
          frame.removeAttribute('srcdoc');
          frame.src = LIVE_URL;
          return;
        }
      } catch (e) {
        console.warn('Live Server chưa sẵn sàng, dùng chế độ tự lực offline:', e.message);
      }

      switchToOfflineMode();
    }

    function switchToOfflineMode() {
      currentMode = 'offline';
      if (btnLive) {
        btnLive.className = 'px-2.5 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-md font-medium transition flex items-center gap-1';
      }
      if (btnOffline) {
        btnOffline.className = 'px-2.5 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-md font-semibold transition flex items-center gap-1 shadow ring-2 ring-amber-400/50';
      }

      frame.removeAttribute('src');
      frame.srcdoc = INLINED_APP_HTML;

      // Đảm bảo tuyệt đối không trắng màn hình: Fallback sau 200ms
      setTimeout(() => {
        try {
          const doc = frame.contentDocument || (frame.contentWindow ? frame.contentWindow.document : null);
          if (doc && (!doc.body || !doc.body.children || doc.body.children.length === 0)) {
            doc.open();
            doc.write(INLINED_APP_HTML);
            doc.close();
          }
        } catch (err) {}
      }, 200);
    }

    function reloadSimulatorFrame() {
      if (currentMode === 'live') {
        frame.src = LIVE_URL + '?t=' + Date.now();
      } else {
        switchToOfflineMode();
      }
    }

    // Tự động kiểm tra và ưu tiên nạp LIVE
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', switchToLiveMode);
    } else {
      switchToLiveMode();
    }

    function getFrameWin() {
      if (!frame) return null;
      return frame.contentWindow || (frame.contentDocument ? frame.contentDocument.defaultView : null);
    }

    function simSwitchTab(tabId) {
      const win = getFrameWin();
      if (win) {
        win.postMessage({ type: 'SIM_SWITCH_TAB', tabId }, '*');
        try { if (win.switchTab) win.switchTab(tabId); } catch (e) {}
      }
    }

    function simOpenOrder(slug) {
      const win = getFrameWin();
      if (win) {
        win.postMessage({ type: 'SIM_OPEN_ORDER', slug }, '*');
        try { if (win.openInstantOrder) win.openInstantOrder(slug); } catch (e) {}
      }
    }

    function simTestCare(code) {
      const win = getFrameWin();
      if (win) {
        win.postMessage({ type: 'SIM_TEST_CARE', code }, '*');
        try {
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
        } catch (e) {}
      }
    }

    function simSyncWeb() {
      const win = getFrameWin();
      if (win) {
        win.postMessage({ type: 'SIM_SYNC_WEB' }, '*');
        try { if (win.syncAllLiveContent) win.syncAllLiveContent(); } catch (e) {}
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
        } catch (e) {}
      }
    }
  </script>
</body>
</html>`;

fs.writeFileSync(ARTIFACT_PATH, previewSimulatorHtml, 'utf8');
console.log('✅ Đã đóng gói thành công bản xem trước tự lực vào:', ARTIFACT_PATH);
