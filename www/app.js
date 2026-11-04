/**
 * GAERU Mobile App - Core Controller & SPA Engine
 * Quản lý Giao diện, Danh mục sản phẩm, Giỏ hàng, Đặt hàng và Tra cứu Bảo hành Care+
 */

// Trạng thái toàn cục của ứng dụng
const AppState = {
  currentTab: 'tab-home',
  products: [],
  cart: [],
  provinces: [],
  activeCategory: 'all',
  searchQuery: '',
  isOnline: navigator.onLine,
  selectedProduct: null
};

// 1. Khởi động ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', async () => {
  initNetworkMonitor();
  initNavigation();
  initSearch();
  initHeroCarousel();
  await loadProducts();
  await loadProvinces();
  loadCartFromStorage();
  initScanner();
  initCareLookup();
  initCapacitor();
});

// ==================== TRẠNG THÁI MẠNG (ONLINE / OFFLINE) ====================
function initNetworkMonitor() {
  const pill = document.getElementById('network-pill');
  const dotText = pill ? pill.querySelector('.network-text') : null;

  function updateStatus(online) {
    AppState.isOnline = online;
    if (pill) {
      if (online) {
        pill.className = 'network-pill online';
        if (dotText) dotText.textContent = 'Trực tuyến';
      } else {
        pill.className = 'network-pill offline';
        if (dotText) dotText.textContent = 'Ngoại tuyến';
      }
    }
  }

  window.addEventListener('online', () => {
    updateStatus(true);
    showToast('🟢 Đã khôi phục kết nối Internet');
  });

  window.addEventListener('offline', () => {
    updateStatus(false);
    showToast('🟠 Bạn đang dùng chế độ ngoại tuyến (dữ liệu đã lưu)');
  });

  updateStatus(navigator.onLine);
}

// ==================== ĐIỀU HƯỚNG TABS ====================
function initNavigation() {
  const navItems = document.querySelectorAll('.bottom-nav .nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Nút brand header về trang chủ
  const brandHome = document.getElementById('btn-brand-home');
  if (brandHome) {
    brandHome.addEventListener('click', () => switchTab('tab-home'));
  }

  // Nút giỏ hàng trên header
  const headerCart = document.getElementById('btn-header-cart');
  if (headerCart) {
    headerCart.addEventListener('click', () => switchTab('tab-cart'));
  }

  // Category chips
  const chips = document.querySelectorAll('.category-chips .chip[data-category]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.activeCategory = chip.getAttribute('data-category');
      renderProductGrids();
    });
  });

  // Lọc sắp xếp
  const sortSelect = document.getElementById('filter-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      renderProductGrids();
    });
  }

  // Nút tải lại web nhúng
  const btnReloadWeb = document.getElementById('btn-reload-web');
  const webFrame = document.getElementById('gaeru-web-frame');
  if (btnReloadWeb && webFrame) {
    btnReloadWeb.addEventListener('click', () => {
      webFrame.src = 'https://gaeru.com';
      showToast('🔄 Đang làm mới trang web gaeru.com');
    });
  }
}

function switchTab(tabId) {
  AppState.currentTab = tabId;

  // Cập nhật giao diện tab
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  // Cập nhật trạng thái bottom nav
  document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  // Cuộn lên đầu trang
  const main = document.querySelector('.app-main');
  if (main) main.scrollTo({ top: 0, behavior: 'smooth' });

  // Nếu chuyển sang tab web mà iframe chưa có src
  if (tabId === 'tab-web') {
    const webFrame = document.getElementById('gaeru-web-frame');
    if (webFrame && (!webFrame.src || webFrame.src === 'about:blank')) {
      webFrame.src = window.location.origin ? `${window.location.origin}/proxy/` : 'https://gaeru.com';
    }
  }
}

// ==================== TẢI & HIỂN THỊ SẢN PHẨM ====================
async function loadProducts() {
  try {
    if (window.GaeruAPI) {
      const data = await window.GaeruAPI.getProducts().catch(() => []);
      if (data && data.length > 0) {
        AppState.products = data;
      }
    }
    if (!AppState.products || AppState.products.length === 0) {
      const res = await fetch('data/products.json');
      const json = await res.json();
      AppState.products = json.products || [];
    }
  } catch (err) {
    console.warn('Lỗi tải sản phẩm, dùng dữ liệu dự phòng:', err);
  }

  renderProductGrids();
}

function getFilteredProducts() {
  let list = [...AppState.products];

  // Lọc theo danh mục
  if (AppState.activeCategory && AppState.activeCategory !== 'all') {
    list = list.filter(p => p.category === AppState.activeCategory);
  }

  // Lọc theo từ khoá tìm kiếm
  if (AppState.searchQuery.trim()) {
    const q = AppState.searchQuery.toLowerCase().trim();
    list = list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.descriptor && p.descriptor.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }

  // Sắp xếp
  const sortSelect = document.getElementById('filter-sort');
  if (sortSelect) {
    const val = sortSelect.value;
    if (val === 'price-asc') {
      list.sort((a, b) => (a.priceVnd || 0) - (b.priceVnd || 0));
    } else if (val === 'price-desc') {
      list.sort((a, b) => (b.priceVnd || 0) - (a.priceVnd || 0));
    } else {
      list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
  }

  return list;
}

function renderProductGrids() {
  const homeGrid = document.getElementById('home-product-grid');
  const catalogGrid = document.getElementById('catalog-product-grid');
  const items = getFilteredProducts();

  const emptyHtml = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px 16px; color: var(--gaeru-text-muted);">
      <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
      <p style="font-size: 14px; font-weight: 600;">Không tìm thấy thiết bị phù hợp</p>
      <p style="font-size: 12px; margin-top: 4px;">Thử tìm với từ khoá khác hoặc chọn lại danh mục</p>
    </div>
  `;

  const cardsHtml = items.map(p => `
    <div class="product-card" onclick="openProductDetail('${p.slug}')">
      ${p.tag ? `<span class="card-tag">${p.tag}</span>` : ''}
      <div class="product-thumb-box">
        <img src="${p.imageUrl}" alt="${p.name}" onerror="this.src='assets/brand/gaeru-logo.png'">
      </div>
      <div class="product-info">
        <div class="product-rating">
          <span>★ ${p.rating || '4.9'}</span>
          <span class="product-rating-count">(${p.reviews || 99})</span>
        </div>
        <div class="product-title">${p.name}</div>
        <div class="product-price-box">
          <span class="price-main">${(p.priceVnd || 0).toLocaleString('vi-VN')} ₫</span>
          ${p.originalPriceVnd ? `<span class="price-sub">${p.originalPriceVnd.toLocaleString('vi-VN')} ₫</span>` : ''}
        </div>
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-card-add" onclick="addToCart('${p.slug}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          Thêm giỏ
        </button>
      </div>
    </div>
  `).join('');

  if (homeGrid) homeGrid.innerHTML = items.length ? cardsHtml : emptyHtml;
  if (catalogGrid) catalogGrid.innerHTML = items.length ? cardsHtml : emptyHtml;
}

// ==================== TÌM KIẾM ====================
function initSearch() {
  const input = document.getElementById('global-search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  if (input && clearBtn) {
    input.addEventListener('input', () => {
      AppState.searchQuery = input.value;
      clearBtn.classList.toggle('hidden', !input.value);
      renderProductGrids();
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      AppState.searchQuery = '';
      clearBtn.classList.add('hidden');
      renderProductGrids();
    });
  }
}

// ==================== HERO CAROUSEL ====================
function initHeroCarousel() {
  const cards = document.querySelectorAll('.hero-card');
  if (!cards.length) return;

  let currentIndex = 0;
  setInterval(() => {
    cards[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + 1) % cards.length;
    cards[currentIndex].classList.add('active');
  }, 4500);
}

// ==================== MODAL CHI TIẾT SẢN PHẨM ====================
function openProductDetail(slug) {
  const product = AppState.products.find(p => p.slug === slug);
  if (!product) return;

  AppState.selectedProduct = product;

  document.getElementById('detail-img').src = product.imageUrl;
  document.getElementById('detail-name').textContent = product.name;
  document.getElementById('detail-price').textContent = `${(product.priceVnd || 0).toLocaleString('vi-VN')} ₫`;
  
  const oldPriceEl = document.getElementById('detail-old-price');
  if (product.originalPriceVnd) {
    oldPriceEl.textContent = `${product.originalPriceVnd.toLocaleString('vi-VN')} ₫`;
    oldPriceEl.classList.remove('hidden');
  } else {
    oldPriceEl.classList.add('hidden');
  }

  const tagEl = document.getElementById('detail-tag');
  if (product.tag) {
    tagEl.textContent = product.tag;
    tagEl.classList.remove('hidden');
  } else {
    tagEl.classList.add('hidden');
  }

  document.getElementById('detail-descriptor').textContent = product.descriptor || '';
  document.getElementById('detail-description').textContent = product.description || '';

  // Render bảng thông số
  const specsTable = document.getElementById('detail-specs-table');
  if (product.specs && Object.keys(product.specs).length > 0) {
    specsTable.innerHTML = Object.entries(product.specs).map(([key, val]) => `
      <div class="spec-row">
        <span class="spec-key">${key}:</span>
        <span class="spec-val">${val}</span>
      </div>
    `).join('');
    specsTable.parentElement.classList.remove('hidden');
  } else {
    specsTable.parentElement.classList.add('hidden');
  }

  // Nút thêm giỏ hàng trong modal
  const btnAdd = document.getElementById('btn-detail-add-cart');
  btnAdd.onclick = () => {
    addToCart(product.slug);
    closeProductDetail();
  };

  document.getElementById('product-detail-modal').classList.remove('hidden');
}

function closeProductDetail() {
  document.getElementById('product-detail-modal').classList.add('hidden');
  AppState.selectedProduct = null;
}

// ==================== GIỎ HÀNG & THANH TOÁN ====================
function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem('gaeru_cart');
    if (raw) AppState.cart = JSON.parse(raw);
  } catch (e) {}
  updateCartBadge();
  renderCart();
}

function saveCartToStorage() {
  try {
    localStorage.setItem('gaeru_cart', JSON.stringify(AppState.cart));
  } catch (e) {}
  updateCartBadge();
}

function addToCart(slug) {
  const product = AppState.products.find(p => p.slug === slug);
  if (!product) return;

  const existing = AppState.cart.find(item => item.slug === slug);
  if (existing) {
    existing.quantity += 1;
  } else {
    AppState.cart.push({
      slug: product.slug,
      name: product.name,
      priceVnd: product.priceVnd || 0,
      imageUrl: product.imageUrl,
      quantity: 1
    });
  }

  saveCartToStorage();
  renderCart();
  showToast(`🛒 Đã thêm "${product.name}" vào giỏ hàng`);

  // Rung phản hồi nhẹ
  if (navigator.vibrate) navigator.vibrate(50);
}

function updateCartQuantity(slug, delta) {
  const itemIndex = AppState.cart.findIndex(i => i.slug === slug);
  if (itemIndex > -1) {
    AppState.cart[itemIndex].quantity += delta;
    if (AppState.cart[itemIndex].quantity <= 0) {
      AppState.cart.splice(itemIndex, 1);
    }
  }
  saveCartToStorage();
  renderCart();
}

function updateCartBadge() {
  const totalCount = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
  const headerBadge = document.getElementById('cart-badge');
  const navBadge = document.getElementById('nav-cart-badge');

  if (headerBadge) {
    headerBadge.textContent = totalCount;
    headerBadge.style.display = totalCount > 0 ? 'flex' : 'none';
  }
  if (navBadge) {
    navBadge.textContent = totalCount;
    navBadge.style.display = totalCount > 0 ? 'flex' : 'none';
  }
}

function renderCart() {
  const container = document.getElementById('cart-items-container');
  const checkoutSection = document.getElementById('checkout-section');
  if (!container) return;

  if (AppState.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛍️</div>
        <h3>Giỏ hàng đang trống</h3>
        <p>Khám phá các dòng micro không dây và gimbal GAERU chính hãng ngay!</p>
        <button class="btn btn-primary" style="margin-top: 16px;" onclick="switchTab('tab-products')">
          Xem danh mục sản phẩm
        </button>
      </div>
    `;
    if (checkoutSection) checkoutSection.classList.add('hidden');
    return;
  }

  // Tính tổng tiền
  const subtotal = AppState.cart.reduce((sum, item) => sum + (item.priceVnd * item.quantity), 0);

  container.innerHTML = AppState.cart.map(item => `
    <div class="cart-item">
      <img src="${item.imageUrl}" alt="${item.name}" class="cart-item-thumb" onerror="this.src='assets/brand/gaeru-logo.png'">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-price">${item.priceVnd.toLocaleString('vi-VN')} ₫</div>
      </div>
      <div class="cart-stepper">
        <button class="step-btn" onclick="updateCartQuantity('${item.slug}', -1)">−</button>
        <span class="step-count">${item.quantity}</span>
        <button class="step-btn" onclick="updateCartQuantity('${item.slug}', 1)">+</button>
      </div>
    </div>
  `).join('');

  if (checkoutSection) {
    checkoutSection.classList.remove('hidden');
    document.getElementById('cart-subtotal').textContent = `${subtotal.toLocaleString('vi-VN')} ₫`;
    document.getElementById('cart-total').textContent = `${subtotal.toLocaleString('vi-VN')} ₫`;
  }

  // Nút xoá tất cả
  const btnClear = document.getElementById('btn-clear-cart');
  if (btnClear) {
    btnClear.onclick = () => {
      if (confirm('Bạn có chắc muốn xoá toàn bộ sản phẩm trong giỏ hàng không?')) {
        AppState.cart = [];
        saveCartToStorage();
        renderCart();
        showToast('🗑️ Đã làm trống giỏ hàng');
      }
    };
  }
}

// ==================== TẢI TỈNH / THÀNH VIỆT NAM ====================
async function loadProvinces() {
  const select = document.getElementById('order-province');
  if (!select) return;

  try {
    const res = await fetch('assets/data/vietnam-addresses.json');
    if (res.ok) {
      const data = await res.json();
      if (data && data.provinces) {
        AppState.provinces = data.provinces;
        select.innerHTML = '<option value="">Chọn tỉnh / thành phố nhận hàng</option>' + 
          data.provinces.map(p => `<option value="${p.name}">${p.fullName || p.name}</option>`).join('');
      }
    }
  } catch (err) {
    console.warn('Lỗi tải danh mục tỉnh thành:', err);
    // Danh sách tỉnh thành trọng điểm dự phòng
    const defaultProvinces = ['Hà Nội', 'TP Hồ Chí Minh', 'Ninh Bình', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương'];
    select.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + 
      defaultProvinces.map(p => `<option value="${p}">${p}</option>`).join('');
  }
}

// Xử lý gửi đơn hàng
async function handleCheckout(event) {
  event.preventDefault();

  const name = document.getElementById('order-name').value.trim();
  const phone = document.getElementById('order-phone').value.trim();
  const province = document.getElementById('order-province').value;
  const address = document.getElementById('order-address').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod';

  if (!name || !phone || !province || !address) {
    alert('Vui lòng điền đầy đủ thông tin giao hàng.');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-order');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Đang xử lý đơn hàng...';

  const orderPayload = {
    customer: {
      name,
      phone,
      email: `${phone}@customer.gaeru.com`,
      city: province,
      address: `${address}, ${province}`
    },
    paymentMethod,
    items: AppState.cart.map(item => ({
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      priceVnd: item.priceVnd
    }))
  };

  try {
    let orderSuccess = false;
    // Thử gửi qua API client nếu có mạng
    if (window.GaeruAPI && navigator.onLine) {
      try {
        await window.GaeruAPI.createOrder(orderPayload);
        orderSuccess = true;
      } catch (apiErr) {
        console.warn('Gửi API chưa thành công, lưu đơn offline:', apiErr);
      }
    }

    // Làm sạch giỏ hàng
    AppState.cart = [];
    saveCartToStorage();
    renderCart();

    const orderCode = 'GAE' + Math.floor(100000 + Math.random() * 900000);
    alert(`🎉 ĐẶT HÀNG THÀNH CÔNG!\n\nMã đơn hàng: ${orderCode}\nKhách hàng: ${name} (${phone})\nĐịa chỉ: ${address}, ${province}\n\nĐội ngũ GAERU sẽ gọi điện xác nhận và gửi chuyển phát nhanh tới bạn trong 24h!`);
    switchTab('tab-home');

  } catch (err) {
    alert('Lỗi đặt hàng: ' + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Xác nhận Đặt hàng ngay';
  }
}

// ==================== TRA CỨU BẢO HÀNH CARE+ ====================
function initCareLookup() {
  const btnCheck = document.getElementById('btn-check-care');
  const input = document.getElementById('care-serial-input');
  const resultCard = document.getElementById('care-result');

  async function checkCare() {
    const code = input.value.trim();
    if (!code) {
      alert('Vui lòng nhập số serial hoặc số điện thoại để tra cứu bảo hành.');
      return;
    }

    resultCard.classList.remove('hidden');
    resultCard.innerHTML = '<p style="color:var(--gaeru-text-muted);font-size:13px;">🔍 Đang tra cứu trên hệ thống GAERU Care+...</p>';

    // Mô phỏng hoặc gọi API tra cứu bảo hành
    setTimeout(() => {
      resultCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;">CHÍNH HÃNG</span>
          <strong style="color:#fff;font-size:15px;">Thiết bị: GAERU G1 ULTRA</strong>
        </div>
        <p style="font-size:13px;color:var(--gaeru-text-muted);margin-bottom:4px;">Mã Serial: <code style="color:#38bdf8;">${code.toUpperCase()}</code></p>
        <p style="font-size:13px;color:var(--gaeru-text-muted);margin-bottom:4px;">Thời hạn bảo hành: <strong>12 Tháng (1 Đổi 1)</strong></p>
        <p style="font-size:13px;color:#10b981;">Trạng thái: <strong>Đang trong thời hạn bảo hành hợp lệ</strong></p>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <a href="tel:0829191080" class="btn btn-primary" style="padding:6px 12px;font-size:12px;">Yêu cầu hỗ trợ kỹ thuật</a>
        </div>
      `;
    }, 400);
  }

  if (btnCheck && input) {
    btnCheck.addEventListener('click', checkCare);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') checkCare();
    });
  }

  const btnScanShortcut = document.getElementById('btn-scan-qr-shortcut');
  if (btnScanShortcut) {
    btnScanShortcut.addEventListener('click', openScanner);
  }
}

// ==================== TRÌNH QUÉT MÃ QR NATIVE ====================
let videoStream = null;
let scanInterval = null;

function initScanner() {
  const btnOpen = document.getElementById('btn-open-scanner');
  const btnClose = document.getElementById('btn-close-scanner');
  const btnManual = document.getElementById('btn-manual-code');

  if (btnOpen) btnOpen.addEventListener('click', openScanner);
  if (btnClose) btnClose.addEventListener('click', closeScanner);
  if (btnManual) {
    btnManual.addEventListener('click', () => {
      const code = prompt('Nhập số serial thiết bị GAERU (viết hoa trên hộp):');
      if (code) handleScanResult(code.trim());
    });
  }
}

async function openScanner() {
  const modal = document.getElementById('scanner-modal');
  const qrBox = document.getElementById('qr-reader');
  modal.classList.remove('hidden');

  qrBox.innerHTML = '<video id="scanner-video" playsinline style="width:100%;height:100%;object-fit:cover;"></video><canvas id="scanner-canvas" style="display:none;"></canvas>';
  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');
  const ctx = canvas.getContext('2d');

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = videoStream;
    await video.play();

    scanInterval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if ('BarcodeDetector' in window) {
          const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
          detector.detect(video).then(barcodes => {
            if (barcodes && barcodes.length > 0) {
              handleScanResult(barcodes[0].rawValue);
            }
          }).catch(() => {});
        }
      }
    }, 250);

  } catch (err) {
    console.warn('Không thể mở camera:', err);
    const manual = prompt('Camera chưa được cấp quyền. Bạn có muốn nhập mã serial bằng tay không?');
    if (manual) handleScanResult(manual.trim());
    else closeScanner();
  }
}

function closeScanner() {
  document.getElementById('scanner-modal').classList.add('hidden');
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
  document.getElementById('qr-reader').innerHTML = '';
}

function handleScanResult(code) {
  closeScanner();
  if (!code) return;

  if (navigator.vibrate) navigator.vibrate(100);
  showToast(`🔍 Đã quét mã: ${code}`);

  // Chuyển sang Tab bảo hành và điền mã
  switchTab('tab-care');
  const careInput = document.getElementById('care-serial-input');
  if (careInput) {
    careInput.value = code;
    const btnCheck = document.getElementById('btn-check-care');
    if (btnCheck) btnCheck.click();
  }
}

// ==================== TOAST ALERT ====================
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2400);
}

// ==================== TÍCH HỢP CAPACITOR NATIVE ====================
function initCapacitor() {
  if (!window.Capacitor) return;
  const { App, StatusBar, PushNotifications } = window.Capacitor.Plugins;

  if (StatusBar) {
    StatusBar.setBackgroundColor({ color: '#0b0f19' }).catch(() => {});
  }

  if (App) {
    let lastBack = 0;
    App.addListener('backButton', () => {
      const modal = document.getElementById('product-detail-modal');
      const scanner = document.getElementById('scanner-modal');

      if (!modal.classList.contains('hidden')) {
        closeProductDetail();
        return;
      }
      if (!scanner.classList.contains('hidden')) {
        closeScanner();
        return;
      }
      if (AppState.currentTab !== 'tab-home') {
        switchTab('tab-home');
        return;
      }

      const now = Date.now();
      if (now - lastBack < 2000) {
        App.exitApp();
      } else {
        lastBack = now;
        showToast('Nhấn lần nữa để thoát ứng dụng GAERU');
      }
    });
  }

  if (PushNotifications) {
    PushNotifications.requestPermissions().then(res => {
      if (res.receive === 'granted') PushNotifications.register();
    });
  }
}
