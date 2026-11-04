/**
 * GAERU Mobile App - Core Controller & SPA Engine
 * Quản lý Giao diện, Danh mục sản phẩm, Giỏ hàng, Đặt hàng và Tra cứu Bảo hành Care+
 * Đã tối ưu hoá 100% tương thích màn hình di động, cử chỉ vuốt và bàn phím ảo.
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
  selectedProduct: null,
  selectedVariant: null,
  user: {
    name: 'Khách hàng GAERU',
    phone: '',
    email: '',
    province: '',
    address: ''
  },
  orders: [],
  devices: []
};

// 1. Khởi động ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', async () => {
  initThemeDetection();
  initNetworkMonitor();
  initNavigation();
  initSearch();
  initHeroCarousel();
  initSheetDragToDismiss();
  initKeyboardAdaptation();
  await loadProducts();
  await loadProvinces();
  loadCartFromStorage();
  initAccount();
  initCareLookup();
  initCapacitor();
  initRealtimeSync();
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
    showToast('🟢 Đã kết nối Internet');
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
      if (navigator.vibrate) navigator.vibrate(10);
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

  // Rung phản hồi nhẹ
  if (navigator.vibrate) navigator.vibrate(15);

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

// ==================== CHUẨN HOÁ & HIỂN THỊ SẢN PHẨM ====================
function normalizeProduct(raw) {
  if (!raw) return null;

  // 1. Chuẩn hoá hình ảnh
  let imageUrl = raw.imageUrl || '';
  if (imageUrl.startsWith('/')) {
    imageUrl = `https://gaeru.com${imageUrl}`;
  } else if (!imageUrl && raw.gallery && raw.gallery.length > 0) {
    imageUrl = raw.gallery[0].startsWith('/') ? `https://gaeru.com${raw.gallery[0]}` : raw.gallery[0];
  }
  if (!imageUrl) {
    imageUrl = 'assets/brand/gaeru-logo.png';
  }

  // 2. Chuẩn hoá các biến thể (variants)
  const variants = Array.isArray(raw.variants) ? raw.variants.map(v => ({
    id: v.id,
    sku: v.sku || '',
    name: v.name || 'Tiêu chuẩn',
    priceVnd: Number(v.priceVnd || v.price_vnd || 0),
    originalPriceVnd: Number(v.originalPriceVnd || v.original_price_vnd || v.priceVnd || 0),
    stockQuantity: typeof v.stockQuantity === 'number' ? v.stockQuantity : (v.stock_quantity ?? 100),
    active: v.active !== false,
    options: v.options || {},
    imageUrl: v.imageUrl ? (v.imageUrl.startsWith('/') ? `https://gaeru.com${v.imageUrl}` : v.imageUrl) : imageUrl
  })) : [];

  // 3. Chuẩn hoá giá: nếu sản phẩm chưa có giá trực tiếp, lấy từ biến thể
  let priceVnd = Number(raw.priceVnd || 0);
  let originalPriceVnd = Number(raw.originalPriceVnd || 0);
  if (!priceVnd && variants.length > 0) {
    const prices = variants.map(v => v.priceVnd).filter(p => p > 0);
    if (prices.length > 0) {
      priceVnd = Math.min(...prices);
      const matched = variants.find(v => v.priceVnd === priceVnd);
      if (matched && matched.originalPriceVnd) originalPriceVnd = matched.originalPriceVnd;
    }
  }

  // 4. Chuẩn hoá thông số kỹ thuật (specs)
  let specs = raw.specs;
  if (!specs || typeof specs !== 'object' || Object.keys(specs).length === 0) {
    specs = {};
    if (raw.description) {
      const lines = raw.description.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        if (line.includes(':') && !line.includes('http')) {
          const parts = line.split(':');
          const k = parts[0].trim();
          const v = parts.slice(1).join(':').trim();
          if (k.length <= 30 && v.length <= 100) {
            specs[k] = v;
          }
        }
      });
      if (Object.keys(specs).length === 0 && raw.description.includes('Thông số')) {
        const idx = raw.description.indexOf('Thông số');
        const specPart = raw.description.slice(idx);
        const specLines = specPart.split('\n').map(l => l.trim()).filter(Boolean);
        if (specLines[1]) specs['Cấu hình'] = specLines[1];
        if (specLines[2]) specs['Pin & Nguồn'] = specLines[2];
        if (specLines[3]) specs['Kích thước'] = specLines[3];
      }
    }
  }

  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    category: raw.category || 'audio',
    tag: raw.tag || (raw.slug === 'gaeru-m3' ? 'BÁN CHẠY NHẤT' : (raw.slug === 'gaeru-g1-ultra' ? 'FLAGSHIP' : '')),
    rating: raw.rating || 4.9,
    reviews: raw.reviews || (raw.slug === 'gaeru-m3' ? 142 : 88),
    descriptor: raw.descriptor || '',
    description: raw.description || '',
    imageUrl,
    gallery: Array.isArray(raw.gallery) ? raw.gallery.map(g => g.startsWith('/') ? `https://gaeru.com${g}` : g) : [imageUrl],
    priceVnd,
    originalPriceVnd,
    variants,
    specs,
    active: raw.active !== false,
    sortOrder: raw.sortOrder || 0
  };
}

async function loadProducts() {
  try {
    let rawList = [];
    if (window.GaeruAPI) {
      rawList = await window.GaeruAPI.getProducts().catch(() => []);
    }
    if (!rawList || rawList.length === 0) {
      const res = await fetch('data/products.json');
      const json = await res.json();
      rawList = json.products || [];
    }
    AppState.products = (rawList || []).map(normalizeProduct).filter(Boolean);
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

  const cardsHtml = items.map(p => {
    const hasVariants = p.variants && p.variants.length > 1;
    const priceText = (p.priceVnd || 0).toLocaleString('vi-VN') + ' ₫';
    return `
    <div class="product-card" onclick="openProductDetail('${p.slug}')">
      ${p.tag ? `<span class="card-tag">${p.tag}</span>` : ''}
      <div class="product-thumb-box">
        <img src="${p.imageUrl}" alt="${p.name}" loading="lazy" decoding="async" onerror="this.src='assets/brand/gaeru-logo.png'">
      </div>
      <div class="product-info">
        <div class="product-rating">
          <span>★ ${p.rating || '4.9'}</span>
          <span class="product-rating-count">(${p.reviews || 99})</span>
        </div>
        <div class="product-title">${p.name}</div>
        ${hasVariants ? `<div style="font-size:11px;color:var(--gaeru-blue);font-weight:600;margin-bottom:2px;">${p.variants.length} phân loại kết nối</div>` : ''}
        <div class="product-price-box">
          <span class="price-main">${hasVariants ? 'Từ ' : ''}${priceText}</span>
          ${p.originalPriceVnd && p.originalPriceVnd > p.priceVnd ? `<span class="price-sub">${p.originalPriceVnd.toLocaleString('vi-VN')} ₫</span>` : ''}
        </div>
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn-card-add" onclick="openInstantOrder('${p.slug}')">
          Đặt mua ngay
        </button>
      </div>
    </div>
  `;
  }).join('');

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

// ==================== HERO CAROUSEL VỚI GESTURE VUỐT ====================
function initHeroCarousel() {
  const container = document.querySelector('.hero-carousel');
  const cards = document.querySelectorAll('.hero-card');
  if (!cards.length || !container) return;

  let currentIndex = 0;
  let timer = null;

  function setSlide(index) {
    cards[currentIndex].classList.remove('active');
    currentIndex = (index + cards.length) % cards.length;
    cards[currentIndex].classList.add('active');
  }

  function nextSlide() {
    setSlide(currentIndex + 1);
  }

  function prevSlide() {
    setSlide(currentIndex - 1);
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(nextSlide, 5000);
  }

  resetTimer();

  // Gesture vuốt ngón tay chuyển banner trên màn hình cảm ứng
  let touchStartX = 0;
  let touchStartY = 0;

  container.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
      resetTimer();
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }, { passive: true });
}

// ==================== MODAL CHI TIẾT SẢN PHẨM & CỬ CHỈ VUỐT XUỐNG ĐỂ ĐÓNG ====================
function openProductDetail(slug) {
  const product = AppState.products.find(p => p.slug === slug);
  if (!product) return;

  AppState.selectedProduct = product;
  AppState.selectedVariant = (product.variants && product.variants.length > 0) ? product.variants[0] : null;

  document.getElementById('detail-img').src = AppState.selectedVariant?.imageUrl || product.imageUrl;
  document.getElementById('detail-name').textContent = product.name;
  
  const currentPrice = AppState.selectedVariant?.priceVnd || product.priceVnd || 0;
  document.getElementById('detail-price').textContent = `${currentPrice.toLocaleString('vi-VN')} ₫`;
  
  const currentOldPrice = AppState.selectedVariant?.originalPriceVnd || product.originalPriceVnd || 0;
  const oldPriceEl = document.getElementById('detail-old-price');
  if (currentOldPrice && currentOldPrice > currentPrice) {
    oldPriceEl.textContent = `${currentOldPrice.toLocaleString('vi-VN')} ₫`;
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

  // Render các biến thể nếu có
  renderDetailVariants(product);

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

  // Nút đặt mua ngay trong modal chi tiết
  const btnBuyNow = document.getElementById('btn-detail-buy-now');
  if (btnBuyNow) {
    btnBuyNow.onclick = () => {
      const vId = AppState.selectedVariant?.id;
      closeProductDetail();
      openInstantOrder(product.slug, vId);
    };
  }

  const modal = document.getElementById('product-detail-modal');
  const content = modal.querySelector('.modal-content');
  if (content) content.style.transform = '';
  modal.classList.remove('hidden');

  if (navigator.vibrate) navigator.vibrate(15);
}

function renderDetailVariants(product) {
  const container = document.getElementById('detail-variants-container');
  const chipsGrid = document.getElementById('detail-variants-chips');
  const badge = document.getElementById('detail-selected-variant-name');

  if (!container || !chipsGrid) return;

  if (!product.variants || product.variants.length <= 1) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  if (badge && AppState.selectedVariant) {
    badge.textContent = AppState.selectedVariant.name;
  }

  chipsGrid.innerHTML = product.variants.map(v => {
    const isSelected = AppState.selectedVariant && AppState.selectedVariant.id === v.id;
    const isOutOfStock = v.stockQuantity === 0;
    const diff = v.priceVnd !== product.priceVnd ? ` (${v.priceVnd.toLocaleString('vi-VN')} ₫)` : '';
    return `
      <button type="button" 
        class="variant-chip ${isSelected ? 'active' : ''} ${isOutOfStock ? 'disabled' : ''}" 
        onclick="selectDetailVariant('${v.id}')"
        ${isOutOfStock ? 'disabled title="Phiên bản tạm hết hàng"' : ''}>
        <span>${v.name}${isOutOfStock ? ' (Hết hàng)' : ''}</span>
        ${diff ? `<span class="variant-chip-price">${diff}</span>` : ''}
      </button>
    `;
  }).join('');
}

function selectDetailVariant(variantId) {
  if (!AppState.selectedProduct || !AppState.selectedProduct.variants) return;
  const variant = AppState.selectedProduct.variants.find(v => v.id === variantId);
  if (!variant || variant.stockQuantity === 0) return;

  AppState.selectedVariant = variant;

  const badge = document.getElementById('detail-selected-variant-name');
  if (badge) badge.textContent = variant.name;

  const priceEl = document.getElementById('detail-price');
  if (priceEl) priceEl.textContent = `${variant.priceVnd.toLocaleString('vi-VN')} ₫`;

  const oldPriceEl = document.getElementById('detail-old-price');
  if (oldPriceEl) {
    if (variant.originalPriceVnd && variant.originalPriceVnd > variant.priceVnd) {
      oldPriceEl.textContent = `${variant.originalPriceVnd.toLocaleString('vi-VN')} ₫`;
      oldPriceEl.classList.remove('hidden');
    } else {
      oldPriceEl.classList.add('hidden');
    }
  }

  if (variant.imageUrl) {
    const img = document.getElementById('detail-img');
    if (img) img.src = variant.imageUrl;
  }

  // Cập nhật lại giao diện các chip
  document.querySelectorAll('#detail-variants-chips .variant-chip').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(variantId));
  });

  if (navigator.vibrate) navigator.vibrate(10);
}

function closeProductDetail() {
  const modal = document.getElementById('product-detail-modal');
  const content = modal ? modal.querySelector('.modal-content') : null;
  if (content) content.style.transform = '';
  if (modal) modal.classList.add('hidden');
  AppState.selectedProduct = null;
  AppState.selectedVariant = null;
}

// Cử chỉ vuốt thanh kéo để đóng modal trơn tru
function initSheetDragToDismiss() {
  const modal = document.getElementById('product-detail-modal');
  const content = modal ? modal.querySelector('.modal-content') : null;
  const handle = modal ? modal.querySelector('.modal-drag-handle') : null;
  if (!content || !handle) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    content.style.transition = 'none';
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 0) {
      content.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    content.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    const deltaY = currentY - startY;
    if (deltaY > 80) {
      closeProductDetail();
    } else {
      content.style.transform = '';
    }
  });
}

// ==================== TỐI ƯU KHI BÀN PHÍM ẢO MỞ TRÊN ĐIỆN THOẠI ====================
function initKeyboardAdaptation() {
  const formInputs = document.querySelectorAll('.checkout-form-card input, .checkout-form-card select, #care-serial-input');
  formInputs.forEach(input => {
    input.addEventListener('focus', () => {
      document.body.classList.add('keyboard-open');
    });
    input.addEventListener('blur', () => {
      // Đợi ngắn để nếu chuyển sang ô khác không bị giật
      setTimeout(() => {
        if (!document.activeElement || !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
          document.body.classList.remove('keyboard-open');
        }
      }, 100);
    });
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      const isKeyboard = window.visualViewport.height < window.innerHeight - 120;
      document.body.classList.toggle('keyboard-open', isKeyboard);
    });
  }
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

  if (navigator.vibrate) navigator.vibrate(40);
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
  if (navigator.vibrate) navigator.vibrate(20);
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
  const profSelect = document.getElementById('profile-input-province');
  const instantSelect = document.getElementById('instant-order-province');
  if (!select && !profSelect && !instantSelect) return;

  try {
    const res = await fetch('assets/data/vietnam-addresses.json');
    if (res.ok) {
      const data = await res.json();
      if (data && data.provinces) {
        AppState.provinces = data.provinces;
        const optionsHtml = data.provinces.map(p => `<option value="${p.name}">${p.fullName || p.name}</option>`).join('');
        if (select) {
          select.innerHTML = '<option value="">Chọn tỉnh / thành phố nhận hàng</option>' + optionsHtml;
        }
        if (profSelect) {
          profSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + optionsHtml;
          if (AppState.user && AppState.user.province) profSelect.value = AppState.user.province;
        }
        if (instantSelect) {
          instantSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + optionsHtml;
          if (AppState.user && AppState.user.province) instantSelect.value = AppState.user.province;
        }
      }
    }
  } catch (err) {
    console.warn('Lỗi tải danh mục tỉnh thành:', err);
    const defaultProvinces = ['Hà Nội', 'TP Hồ Chí Minh', 'Ninh Bình', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương'];
    const defHtml = defaultProvinces.map(p => `<option value="${p}">${p}</option>`).join('');
    if (select) select.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + defHtml;
    if (profSelect) profSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + defHtml;
    if (instantSelect) instantSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' + defHtml;
  }

  // Tự động điền dữ liệu người dùng vào checkout form nếu có
  applyProfileToCheckoutForm();
}

// ==================== ĐẶT MUA NHANH TRỰC TIẾP (INSTANT CHECKOUT) ====================
let instantOrderState = {
  product: null,
  variant: null,
  quantity: 1
};

function openInstantOrder(slug, variantId) {
  const product = AppState.products.find(p => p.slug === slug);
  if (!product) return;

  let selectedVar = null;
  if (variantId && product.variants) {
    selectedVar = product.variants.find(v => v.id === variantId);
  }
  if (!selectedVar && product.variants && product.variants.length > 0) {
    selectedVar = product.variants.find(v => v.stockQuantity > 0) || product.variants[0];
  }

  instantOrderState.product = product;
  instantOrderState.variant = selectedVar;
  instantOrderState.quantity = 1;

  const modal = document.getElementById('instant-order-modal');
  if (!modal) return;

  document.getElementById('instant-item-img').src = selectedVar?.imageUrl || product.imageUrl;
  document.getElementById('instant-item-name').textContent = product.name;
  
  const varLabel = document.getElementById('instant-item-variant');
  if (varLabel) {
    if (selectedVar && product.variants && product.variants.length > 1) {
      varLabel.textContent = `Phiên bản: ${selectedVar.name}`;
      varLabel.classList.remove('hidden');
    } else {
      varLabel.classList.add('hidden');
    }
  }

  const currentPrice = selectedVar?.priceVnd || product.priceVnd || 0;
  document.getElementById('instant-item-price').textContent = `${currentPrice.toLocaleString('vi-VN')} ₫`;
  document.getElementById('instant-item-qty').textContent = '1';
  updateInstantOrderTotal();

  // Render bộ chọn phiên bản nhanh trong Instant Order
  renderInstantVariants(product, selectedVar);

  // Tự động điền dữ liệu hồ sơ nếu người dùng đã lưu
  const nameInput = document.getElementById('instant-order-name');
  const phoneInput = document.getElementById('instant-order-phone');
  const provSelect = document.getElementById('instant-order-province');
  const addrInput = document.getElementById('instant-order-address');

  if (provSelect && provSelect.options.length <= 1 && AppState.provinces.length > 0) {
    provSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' +
      AppState.provinces.map(p => `<option value="${p.name}">${p.fullName || p.name}</option>`).join('');
  }

  if (nameInput) nameInput.value = (AppState.user.name && AppState.user.name !== 'Khách hàng GAERU') ? AppState.user.name : '';
  if (phoneInput) phoneInput.value = AppState.user.phone || '';
  if (provSelect && AppState.user.province) provSelect.value = AppState.user.province;
  if (addrInput) addrInput.value = AppState.user.address || '';

  closeProductDetail();
  modal.classList.remove('hidden');
}

function renderInstantVariants(product, selectedVar) {
  const container = document.getElementById('instant-variants-container');
  const chipsWrap = document.getElementById('instant-variants-chips');
  if (!container || !chipsWrap) return;

  if (!product.variants || product.variants.length <= 1) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  chipsWrap.innerHTML = product.variants.map(v => {
    const isSelected = selectedVar && selectedVar.id === v.id;
    const isOutOfStock = v.stockQuantity === 0;
    return `
      <button type="button" 
        class="instant-var-pill ${isSelected ? 'active' : ''} ${isOutOfStock ? 'disabled' : ''}"
        onclick="selectInstantVariant('${v.id}')"
        ${isOutOfStock ? 'disabled title="Hết hàng"' : ''}>
        ${v.name}${isOutOfStock ? ' (Hết)' : ''}
      </button>
    `;
  }).join('');
}

function selectInstantVariant(variantId) {
  if (!instantOrderState.product || !instantOrderState.product.variants) return;
  const variant = instantOrderState.product.variants.find(v => v.id === variantId);
  if (!variant || variant.stockQuantity === 0) return;

  instantOrderState.variant = variant;

  const varLabel = document.getElementById('instant-item-variant');
  if (varLabel) varLabel.textContent = `Phiên bản: ${variant.name}`;

  const priceEl = document.getElementById('instant-item-price');
  if (priceEl) priceEl.textContent = `${variant.priceVnd.toLocaleString('vi-VN')} ₫`;

  if (variant.imageUrl) {
    const img = document.getElementById('instant-item-img');
    if (img) img.src = variant.imageUrl;
  }

  document.querySelectorAll('#instant-variants-chips .instant-var-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(variantId));
  });

  updateInstantOrderTotal();
  if (navigator.vibrate) navigator.vibrate(10);
}

function closeInstantOrder() {
  const modal = document.getElementById('instant-order-modal');
  if (modal) modal.classList.add('hidden');
}

function changeInstantQty(delta) {
  const nextQty = instantOrderState.quantity + delta;
  if (nextQty < 1 || nextQty > 99) return;
  instantOrderState.quantity = nextQty;
  document.getElementById('instant-item-qty').textContent = nextQty;
  updateInstantOrderTotal();
}

function updateInstantOrderTotal() {
  if (!instantOrderState.product) return;
  const unitPrice = instantOrderState.variant?.priceVnd || instantOrderState.product.priceVnd || 0;
  const total = unitPrice * instantOrderState.quantity;
  const totalEl = document.getElementById('instant-order-total');
  if (totalEl) totalEl.textContent = `${total.toLocaleString('vi-VN')} ₫`;
}

async function handleInstantCheckout(event) {
  if (event) event.preventDefault();
  if (!instantOrderState.product) return;

  const name = document.getElementById('instant-order-name').value.trim();
  const phone = document.getElementById('instant-order-phone').value.trim();
  const province = document.getElementById('instant-order-province').value;
  const address = document.getElementById('instant-order-address').value.trim();
  const paymentMethod = document.querySelector('input[name="instantPaymentMethod"]:checked')?.value || 'cod';

  if (!name || !phone || !province || !address) {
    alert('Vui lòng điền đầy đủ thông tin giao hàng.');
    return;
  }

  const btnSubmit = document.getElementById('btn-submit-instant-order');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Đang gửi đơn hàng lên hệ thống...';
  }

  const unitPrice = instantOrderState.variant?.priceVnd || instantOrderState.product.priceVnd || 0;
  const totalVnd = unitPrice * instantOrderState.quantity;
  const variantName = instantOrderState.variant?.name ? ` (${instantOrderState.variant.name})` : '';
  const itemSummary = `${instantOrderState.quantity}x ${instantOrderState.product.name}${variantName}`;

  let createdOrderNumber = 'GAE' + Math.floor(100000 + Math.random() * 900000);
  let isLiveCreated = false;

  // Gửi trực tiếp lên backend GAERU
  try {
    if (window.GaeruAPI && navigator.onLine) {
      const orderPayload = {
        customer: {
          name,
          email: AppState.user.email || `${phone.replace(/\D/g, '')}@khachhang.gaeru.com`,
          phone,
          address: `${address}, ${province}`,
          city: province,
          note: `Đặt qua GAERU Mobile App${variantName ? ' - ' + variantName : ''}`
        },
        paymentMethod: paymentMethod === 'cod' ? 'cod' : 'bank_transfer',
        items: [
          {
            variantId: instantOrderState.variant?.id || instantOrderState.product.variants?.[0]?.id,
            quantity: instantOrderState.quantity
          }
        ]
      };

      const result = await window.GaeruAPI.createOrder(orderPayload);
      if (result && (result.orderNumber || result.order?.orderNumber)) {
        createdOrderNumber = result.orderNumber || result.order.orderNumber;
        isLiveCreated = true;
      }
    }
  } catch (apiErr) {
    console.warn('[ORDER] Gửi API máy chủ chưa thành công, lưu đơn offline:', apiErr.message);
  }

  const orderRecord = {
    code: createdOrderNumber,
    date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    totalVnd: totalVnd,
    itemSummary: itemSummary,
    paymentMethod: paymentMethod,
    statusClass: isLiveCreated ? 'confirmed' : 'pending',
    statusText: isLiveCreated ? 'Đã tiếp nhận (Realtime)' : 'Chờ xác nhận'
  };

  AppState.orders.unshift(orderRecord);
  try {
    localStorage.setItem('gaeru_order_history', JSON.stringify(AppState.orders));
  } catch (e) {}

  // Tự động lưu hồ sơ nếu chưa có
  if (!AppState.user.phone) {
    AppState.user = { name, phone, email: `${phone.replace(/\D/g, '')}@khachhang.gaeru.com`, province, address };
    try {
      localStorage.setItem('gaeru_user_profile', JSON.stringify(AppState.user));
    } catch (e) {}
  }

  renderAccountView();
  closeInstantOrder();

  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Xác nhận đặt hàng ngay';
  }

  alert(`🎉 ĐẶT HÀNG THÀNH CÔNG!\n\nMã đơn: #${createdOrderNumber}\nSản phẩm: ${itemSummary}\nTổng tiền: ${formatVnd(totalVnd)}\nNgười nhận: ${name} (${phone})\nĐịa chỉ: ${address}, ${province}\n\nĐơn hàng đã được lưu vào mục "Tài khoản". Đội ngũ GAERU sẽ liên hệ xác nhận và giao hàng nhanh chóng!`);

  switchTab('tab-account');
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
    if (window.GaeruAPI && navigator.onLine) {
      try {
        await window.GaeruAPI.createOrder(orderPayload);
      } catch (apiErr) {
        console.warn('Gửi API chưa thành công, lưu đơn offline:', apiErr);
      }
    }

    const orderCode = 'GAE' + Math.floor(100000 + Math.random() * 900000);
    const orderTotal = AppState.cart.reduce((sum, item) => sum + (item.priceVnd * item.quantity), 0);
    const itemSummary = AppState.cart.map(i => `${i.quantity}x ${i.name}`).join(', ');

    // Lưu đơn hàng vào Lịch sử đơn hàng của Tab Tài khoản
    const newOrder = {
      code: orderCode,
      date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      totalVnd: orderTotal,
      itemSummary: itemSummary,
      paymentMethod: paymentMethod,
      statusClass: 'pending',
      statusText: 'Chờ xác nhận'
    };

    AppState.orders.unshift(newOrder);
    try {
      localStorage.setItem('gaeru_order_history', JSON.stringify(AppState.orders));
    } catch (e) {}

    // Tự động lưu hồ sơ nếu chưa có
    if (!AppState.user.phone) {
      AppState.user = { name, phone, email: `${phone}@customer.gaeru.com`, province, address };
      try {
        localStorage.setItem('gaeru_user_profile', JSON.stringify(AppState.user));
      } catch (e) {}
    }
    renderAccountView();

    AppState.cart = [];
    saveCartToStorage();
    renderCart();

    alert(`🎉 ĐẶT HÀNG THÀNH CÔNG!\n\nMã đơn hàng: ${orderCode}\nKhách hàng: ${name} (${phone})\nĐịa chỉ: ${address}, ${province}\n\nĐơn hàng đã được lưu vào mục "Tài khoản". Đội ngũ GAERU sẽ liên hệ xác nhận trong 24h!`);
    switchTab('tab-account');

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

    setTimeout(() => {
      resultCard.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;">CHÍNH HÃNG</span>
          <strong style="color:var(--gaeru-text);font-size:15px;">Thiết bị: GAERU G1 ULTRA</strong>
        </div>
        <p style="font-size:13px;color:var(--gaeru-text-muted);margin-bottom:4px;">Mã Serial: <code style="color:#38bdf8;">${code.toUpperCase()}</code></p>
        <p style="font-size:13px;color:var(--gaeru-text-muted);margin-bottom:4px;">Thời hạn bảo hành: <strong>12 Tháng (1 Đổi 1)</strong></p>
        <p style="font-size:13px;color:#10b981;">Trạng thái: <strong>Đang trong thời hạn bảo hành hợp lệ</strong></p>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <a href="tel:0829191080" class="btn btn-primary" style="padding:8px 14px;font-size:12px;">📞 Yêu cầu hỗ trợ kỹ thuật</a>
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
}

// ==================== TÀI KHOẢN NGƯỜI DÙNG & HỒ SƠ ====================
function initAccount() {
  loadUserProfile();
  loadOrderHistory();
  loadRegisteredDevices();
  renderAccountView();

  // Nút mở modal sửa hồ sơ
  const btnEdit = document.getElementById('btn-edit-profile');
  if (btnEdit) btnEdit.addEventListener('click', openProfileModal);

  const addressMenuItem = document.getElementById('account-menu-address');
  if (addressMenuItem) addressMenuItem.addEventListener('click', openProfileModal);

  // Nút chuyển chế độ theme trong tab tài khoản
  const btnAccountTheme = document.getElementById('btn-account-toggle-theme');
  if (btnAccountTheme) {
    btnAccountTheme.addEventListener('click', () => {
      const btnHeaderToggle = document.getElementById('btn-theme-toggle');
      if (btnHeaderToggle) btnHeaderToggle.click();
      updateAccountThemeLabel();
    });
  }
  updateAccountThemeLabel();

  // Nút đồng bộ dữ liệu với máy chủ web gaeru.com
  const btnSync = document.getElementById('btn-sync-data-server');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      showToast('🔄 Đang đồng bộ dữ liệu thời gian thực từ gaeru.com...');
      try {
        if (window.GaeruAPI && window.GaeruAPI.syncNow) {
          const fresh = await window.GaeruAPI.syncNow();
          if (fresh.products && fresh.products.length > 0) {
            AppState.products = fresh.products;
            renderProductGrids();
          }
        } else {
          await loadProducts();
        }
        showToast('✨ Dữ liệu sản phẩm, giá bán & cấu hình đã đồng bộ mới nhất!');
      } catch (err) {
        showToast('⚠️ Không thể kết nối tới máy chủ gaeru.com: ' + (err.message || 'Mạng bận'));
      }
    });
  }

  // Nút chuyển sang bảo hành Care+
  const btnCare = document.getElementById('btn-goto-care');
  const statBoxCare = document.getElementById('stat-box-care');
  const btnPolicy = document.getElementById('btn-goto-policy');
  if (btnCare) btnCare.addEventListener('click', () => switchTab('tab-care'));
  if (statBoxCare) statBoxCare.addEventListener('click', () => switchTab('tab-care'));
  if (btnPolicy) btnPolicy.addEventListener('click', () => switchTab('tab-care'));

  // Nút xem đơn hàng
  const statBoxOrders = document.getElementById('stat-box-orders');
  const linkOrders = document.getElementById('account-view-all-orders');
  if (statBoxOrders) statBoxOrders.addEventListener('click', () => {
    const ordersContainer = document.getElementById('account-orders-container');
    if (ordersContainer) ordersContainer.scrollIntoView({ behavior: 'smooth' });
  });
  if (linkOrders) linkOrders.addEventListener('click', () => {
    const ordersContainer = document.getElementById('account-orders-container');
    if (ordersContainer) ordersContainer.scrollIntoView({ behavior: 'smooth' });
  });

  // Nút đặt lại dữ liệu ứng dụng
  const btnReset = document.getElementById('btn-reset-app-data');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn đặt lại dữ liệu tạm (giỏ hàng, bộ nhớ đệm) của ứng dụng GAERU?')) {
        localStorage.removeItem('gaeru_cart');
        localStorage.removeItem('gaeru_order_history');
        AppState.cart = [];
        AppState.orders = [];
        saveCartToStorage();
        renderCart();
        renderAccountView();
        showToast('🧹 Đã xoá bộ nhớ tạm ứng dụng thành công!');
      }
    });
  }
}

function loadUserProfile() {
  try {
    const raw = localStorage.getItem('gaeru_user_profile');
    if (raw) {
      AppState.user = JSON.parse(raw);
    } else {
      AppState.user = {
        name: 'Khách hàng GAERU',
        phone: '',
        email: '',
        province: '',
        address: ''
      };
    }
  } catch (e) {
    AppState.user = { name: 'Khách hàng GAERU', phone: '', email: '', province: '', address: '' };
  }
}

function saveUserProfile(event) {
  if (event) event.preventDefault();

  const name = document.getElementById('profile-input-name').value.trim();
  const phone = document.getElementById('profile-input-phone').value.trim();
  const email = document.getElementById('profile-input-email').value.trim();
  const province = document.getElementById('profile-input-province').value;
  const address = document.getElementById('profile-input-address').value.trim();

  if (!name || !phone) {
    alert('Vui lòng nhập họ tên và số điện thoại.');
    return;
  }

  AppState.user = { name, phone, email, province, address };
  try {
    localStorage.setItem('gaeru_user_profile', JSON.stringify(AppState.user));
  } catch (e) {}

  applyProfileToCheckoutForm();
  closeProfileModal();
  renderAccountView();
  showToast('✅ Đã lưu thông tin hồ sơ tài khoản!');
}

function applyProfileToCheckoutForm() {
  const orderName = document.getElementById('order-name');
  const orderPhone = document.getElementById('order-phone');
  const orderProv = document.getElementById('order-province');
  const orderAddr = document.getElementById('order-address');

  if (AppState.user && AppState.user.name && AppState.user.name !== 'Khách hàng GAERU' && orderName && !orderName.value) {
    orderName.value = AppState.user.name;
  }
  if (AppState.user && AppState.user.phone && orderPhone && !orderPhone.value) {
    orderPhone.value = AppState.user.phone;
  }
  if (AppState.user && AppState.user.province && orderProv && !orderProv.value) {
    orderProv.value = AppState.user.province;
  }
  if (AppState.user && AppState.user.address && orderAddr && !orderAddr.value) {
    orderAddr.value = AppState.user.address;
  }
}

function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  const provSelect = document.getElementById('profile-input-province');
  if (provSelect && provSelect.options.length <= 1 && AppState.provinces.length > 0) {
    provSelect.innerHTML = '<option value="">Chọn tỉnh / thành phố</option>' +
      AppState.provinces.map(p => `<option value="${p.name}">${p.fullName || p.name}</option>`).join('');
  }

  document.getElementById('profile-input-name').value = AppState.user.name === 'Khách hàng GAERU' ? '' : (AppState.user.name || '');
  document.getElementById('profile-input-phone').value = AppState.user.phone || '';
  document.getElementById('profile-input-email').value = AppState.user.email || '';
  if (provSelect && AppState.user.province) provSelect.value = AppState.user.province;
  document.getElementById('profile-input-address').value = AppState.user.address || '';

  modal.classList.remove('hidden');
}

function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (modal) modal.classList.add('hidden');
}

function loadOrderHistory() {
  try {
    const raw = localStorage.getItem('gaeru_order_history');
    if (raw) {
      AppState.orders = JSON.parse(raw);
    } else {
      AppState.orders = [];
    }
  } catch (e) {
    AppState.orders = [];
  }
}

function loadRegisteredDevices() {
  AppState.devices = [
    {
      name: 'Micro Thu Âm GAERU G1 ULTRA',
      serial: 'GAE-G1-982310',
      daysLeft: 342
    }
  ];
}

function renderAccountView() {
  const nameEl = document.getElementById('account-display-name');
  const phoneEl = document.getElementById('account-display-phone');
  const avatarEl = document.getElementById('account-avatar');
  const addressSavedEl = document.getElementById('account-saved-address');
  const orderCountEl = document.getElementById('account-order-count');
  const deviceCountEl = document.getElementById('account-device-count');

  const displayName = AppState.user.name || 'Khách hàng GAERU';
  if (nameEl) nameEl.textContent = displayName;
  if (phoneEl) phoneEl.textContent = AppState.user.phone ? `📱 ${AppState.user.phone}` : 'Chưa cập nhật số điện thoại';

  if (avatarEl) {
    const firstLetter = displayName.trim().charAt(0).toUpperCase() || 'G';
    avatarEl.textContent = firstLetter;
  }

  if (addressSavedEl) {
    if (AppState.user.address || AppState.user.province) {
      addressSavedEl.textContent = `${AppState.user.address ? AppState.user.address + ', ' : ''}${AppState.user.province || ''}`;
    } else {
      addressSavedEl.textContent = 'Chạm để thiết lập địa chỉ mặc định';
    }
  }

  if (orderCountEl) orderCountEl.textContent = AppState.orders.length;
  if (deviceCountEl) deviceCountEl.textContent = AppState.devices.length;

  renderAccountOrders();
  renderAccountDevices();
}

function renderAccountOrders() {
  const container = document.getElementById('account-orders-container');
  if (!container) return;

  if (!AppState.orders || AppState.orders.length === 0) {
    container.innerHTML = `
      <div class="empty-orders-box">
        <span style="font-size:24px;">🛒</span>
        <p>Bạn chưa có đơn hàng nào.</p>
        <button class="btn btn-secondary" style="font-size:12px;padding:6px 14px;" onclick="switchTab('tab-products')">
          Khám phá sản phẩm ngay
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = AppState.orders.map(order => `
    <div class="order-card-mini">
      <div class="order-header-row">
        <span class="order-code">#${order.code}</span>
        <span class="order-status-badge ${order.statusClass || 'shipping'}">${order.statusText || 'Đang giao hàng'}</span>
      </div>
      <div class="order-summary-row">
        <span class="order-items-desc">${order.itemSummary || 'Thiết bị GAERU'}</span>
        <span class="order-total-price">${formatVnd(order.totalVnd)}</span>
      </div>
      <div style="font-size:11px;color:var(--gaeru-text-muted);display:flex;justify-content:space-between;margin-top:2px;">
        <span>${order.date || 'Hôm nay'}</span>
        <span>${order.paymentMethod === 'cod' ? 'Thanh toán COD' : 'Chuyển khoản VietQR'}</span>
      </div>
    </div>
  `).join('');
}

function renderAccountDevices() {
  const container = document.getElementById('account-devices-container');
  if (!container) return;

  container.innerHTML = AppState.devices.map(device => `
    <div class="device-card-item">
      <div class="device-card-info">
        <strong>${device.name}</strong>
        <span>Serial: <code style="color:#38bdf8;">${device.serial}</code></span>
      </div>
      <span class="device-care-pill">Còn ${device.daysLeft} ngày</span>
    </div>
  `).join('');
}

function updateAccountThemeLabel() {
  const label = document.getElementById('account-current-theme-label');
  if (!label) return;
  const pref = localStorage.getItem('gaeru_theme_preference');
  if (pref === 'dark') {
    label.textContent = '🌙 Chế độ Tối (Dark)';
  } else if (pref === 'light') {
    label.textContent = '☀️ Chế độ Sáng (Light)';
  } else {
    label.textContent = '📱 Tự động theo điện thoại';
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

// ==================== LẮNG NGHE KẾT NỐI REALTIME VỚI GAERU.COM ====================
function initRealtimeSync() {
  if (!window.GaeruAPI || !window.GaeruAPI.subscribeRealtimeUpdates) return;

  window.GaeruAPI.subscribeRealtimeUpdates((event) => {
    if (!event) return;

    if (event.type === 'connected') {
      console.log('[Realtime] Đã kết nối kênh trực tiếp với gaeru.com');
    } else if (event.type === 'product_change' || event.type === 'inventory_change') {
      showToast('⚡ GAERU vừa cập nhật sản phẩm mới từ gaeru.com!');
      loadProducts();
    } else if (event.type === 'notification' && event.message) {
      showToast(`📢 ${event.message}`);
    }
  });
}

// ==================== TÍCH HỢP CAPACITOR NATIVE ====================
function initCapacitor() {
  if (!window.Capacitor) return;
  const { App, StatusBar, PushNotifications } = window.Capacitor.Plugins;

  if (StatusBar) {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    updateNativeStatusBar(isDark);
  }

  if (App) {
    let lastBack = 0;
    App.addListener('backButton', () => {
      const modal = document.getElementById('product-detail-modal');
      const profileModal = document.getElementById('profile-modal');
      const instantModal = document.getElementById('instant-order-modal');

      if (modal && !modal.classList.contains('hidden')) {
        closeProductDetail();
        return;
      }
      if (profileModal && !profileModal.classList.contains('hidden')) {
        closeProfileModal();
        return;
      }
      if (instantModal && !instantModal.classList.contains('hidden')) {
        closeInstantOrder();
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

// ==================== TỰ ĐỘNG TƯƠNG THÍCH THEME (DARK / LIGHT / THEO ĐIỆN THOẠI) ====================
function initThemeDetection() {
  const metaThemeColor = document.getElementById('meta-theme-color');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const iconDark = btnThemeToggle ? btnThemeToggle.querySelector('.theme-icon-dark') : null;
  const iconLight = btnThemeToggle ? btnThemeToggle.querySelector('.theme-icon-light') : null;
  const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function getEffectiveTheme() {
    const saved = localStorage.getItem('gaeru_theme_preference');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Mặc định tự động nhận diện theo hệ thống điện thoại của người dùng
    if (mediaQuery && mediaQuery.matches) {
      return 'dark';
    } else if (mediaQuery && !mediaQuery.matches) {
      return 'light';
    }
    return 'dark'; // Fallback tiêu chuẩn
  }

  function applyTheme(theme, isManual = false) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    // Cập nhật thẻ meta theme-color cho thanh trạng thái webview di động
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#0b0f19' : '#f5f5f7');
    }

    // Cập nhật icon trên nút bấm chuyển đổi
    if (iconDark && iconLight) {
      if (isDark) {
        // Đang tối -> biểu tượng Mặt trời sẵn sàng bấm chuyển sang sáng
        iconDark.classList.add('hidden');
        iconLight.classList.remove('hidden');
      } else {
        // Đang sáng -> biểu tượng Mặt trăng sẵn sàng bấm chuyển sang tối
        iconLight.classList.add('hidden');
        iconDark.classList.remove('hidden');
      }
    }

    // Cập nhật thanh trạng thái StatusBar của điện thoại (Capacitor Native)
    updateNativeStatusBar(isDark);

    if (isManual && navigator.vibrate) {
      navigator.vibrate(15);
    }
  }

  // 1. Áp dụng ngay lúc mở app
  const initialTheme = getEffectiveTheme();
  applyTheme(initialTheme, false);

  // 2. Lắng nghe sự kiện hệ điều hành điện thoại thay đổi giao diện theo thời gian thực
  if (mediaQuery) {
    const handleSystemThemeChange = (e) => {
      // Nếu người dùng chưa gán tùy chọn thủ công, tự động đồng bộ theo điện thoại
      const saved = localStorage.getItem('gaeru_theme_preference');
      if (!saved) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemThemeChange);
    }
  }

  // 3. Cho phép người dùng chuyển đổi thủ công khi chạm vào nút trên top-bar
  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme') || (mediaQuery && mediaQuery.matches ? 'dark' : 'light');
      const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';

      localStorage.setItem('gaeru_theme_preference', nextTheme);
      applyTheme(nextTheme, true);
      showToast(nextTheme === 'dark' ? '🌙 Đã chuyển sang giao diện Tối' : '☀️ Đã chuyển sang giao diện Sáng');
    });
  }
}

function updateNativeStatusBar(isDark) {
  if (!window.Capacitor || !window.Capacitor.Plugins) return;
  const { StatusBar } = window.Capacitor.Plugins;
  if (!StatusBar) return;

  const bgColor = isDark ? '#0b0f19' : '#ffffff';
  // Capacitor StatusBar: Style.Dark (chữ sáng cho nền tối), Style.Light (chữ tối cho nền sáng)
  const statusBarStyle = isDark ? 'DARK' : 'LIGHT';

  try {
    if (StatusBar.setBackgroundColor) {
      StatusBar.setBackgroundColor({ color: bgColor }).catch(() => {});
    }
    if (StatusBar.setStyle) {
      StatusBar.setStyle({ style: statusBarStyle }).catch(() => {});
    }
  } catch (err) {
    // Ignore webview mode
  }
}
