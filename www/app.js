/**
 * GAERU Mobile App Controller & Native Bridge
 * Tích hợp Capacitor, xử lý Mạng, Push Notifications, Phím Back Android và Quét mã Care+
 */

(function () {
  const isNative = !!window.Capacitor;
  const GAERU_BASE_URL = isNative 
    ? 'https://gaeru.com' 
    : (window.location.origin && window.location.protocol.startsWith('http') ? `${window.location.origin}/proxy` : 'https://gaeru.com');

  const iframe = document.getElementById('main-frame');
  const loadingBar = document.getElementById('loading-bar');
  const offlineScreen = document.getElementById('offline-screen');
  const btnRetry = document.getElementById('btn-retry');
  const navItems = document.querySelectorAll('.nav-item[data-url]');
  const btnOpenScanner = document.getElementById('btn-open-scanner');
  const btnCloseScanner = document.getElementById('btn-close-scanner');
  const scannerModal = document.getElementById('scanner-modal');
  const qrReaderContainer = document.getElementById('qr-reader');

  // Khởi tạo nguồn ban đầu cho iframe
  if (iframe) {
    iframe.src = GAERU_BASE_URL;
  }

  let isOnline = navigator.onLine;
  let videoStream = null;
  let scanInterval = null;
  let lastBackPressTime = 0;

  // 1. Quản lý trạng thái kết nối mạng (Online / Offline)
  function setNetworkStatus(online) {
    isOnline = online;
    if (online) {
      offlineScreen.classList.add('hidden');
      if (iframe.src === 'about:blank' || !iframe.src) {
        loadPage(GAERU_BASE_URL);
      }
    } else {
      offlineScreen.classList.remove('hidden');
      renderOfflineProducts();
    }
  }

  window.addEventListener('online', () => setNetworkStatus(true));
  window.addEventListener('offline', () => setNetworkStatus(false));

  btnRetry.addEventListener('click', () => {
    loadingBar.classList.add('active');
    fetch(GAERU_BASE_URL, { method: 'HEAD', mode: 'no-cors' })
      .then(() => {
        setNetworkStatus(true);
        iframe.src = iframe.src || GAERU_BASE_URL;
      })
      .catch(() => {
        setNetworkStatus(false);
        alert('Vẫn chưa có kết nối Internet. Bạn có thể xem danh mục sản phẩm đã lưu bên dưới hoặc gọi hotline.');
      })
      .finally(() => {
        loadingBar.classList.remove('active');
      });
  });

  // 2. Quản lý chuyển trang & Thanh tải (Loading indicator)
  function loadPage(url) {
    if (!isOnline) {
      setNetworkStatus(false);
      return;
    }
    loadingBar.classList.remove('done');
    loadingBar.classList.add('active');
    iframe.src = url;
  }

  iframe.addEventListener('load', () => {
    loadingBar.classList.add('done');
    setTimeout(() => {
      loadingBar.classList.remove('active', 'done');
    }, 400);
  });

  // 3. Thanh điều hướng dưới cùng (Bottom Navigation)
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      let targetUrl = item.getAttribute('data-url');
      if (targetUrl) {
        if (!isNative && targetUrl.startsWith('https://gaeru.com')) {
          targetUrl = targetUrl.replace('https://gaeru.com', GAERU_BASE_URL);
        }
        loadPage(targetUrl);
      }
    });
  });

  // 4. Trình quét mã QR / Barcode Native cho GAERU Care+
  btnOpenScanner.addEventListener('click', () => {
    openScanner();
  });

  btnCloseScanner.addEventListener('click', () => {
    closeScanner();
  });

  async function openScanner() {
    scannerModal.classList.remove('hidden');
    qrReaderContainer.innerHTML = '<video id="scanner-video" playsinline style="width:100%;height:100%;object-fit:cover;"></video><canvas id="scanner-canvas" style="display:none;"></canvas>';
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

      // Bắt đầu quét hình ảnh từ camera
      scanInterval = setInterval(() => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Sử dụng BarcodeDetector API nếu trình duyệt hỗ trợ
          if ('BarcodeDetector' in window) {
            const barcodeDetector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
            barcodeDetector.detect(video).then(barcodes => {
              if (barcodes && barcodes.length > 0) {
                handleScanResult(barcodes[0].rawValue);
              }
            }).catch(() => {});
          }
        }
      }, 300);

    } catch (err) {
      console.warn('Camera error:', err);
      // Fallback nhập thủ công nếu không mở được camera
      const manualCode = prompt('Không thể mở camera trực tiếp. Vui lòng nhập số Serial hoặc mã trên hộp GAERU Care+:');
      if (manualCode) {
        handleScanResult(manualCode.trim());
      } else {
        closeScanner();
      }
    }
  }

  function closeScanner() {
    scannerModal.classList.add('hidden');
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }
    qrReaderContainer.innerHTML = '';
  }

  function handleScanResult(code) {
    closeScanner();
    if (!code) return;

    // Rung nhẹ phản hồi (haptic)
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    // Nếu mã là link website GAERU
    if (code.startsWith('http://') || code.startsWith('https://')) {
      loadPage(code);
    } else {
      // Nếu là mã Serial / Bảo hành, điều hướng thẳng vào trang kích hoạt/tra cứu GAERU Care+
      let careUrl = `${GAERU_BASE_URL}/care.html?serial=${encodeURIComponent(code)}#warranty-activation`;
      loadPage(careUrl);
    }
  }

  // 5. Tích hợp sâu Capacitor (Nếu đang chạy trong Native App iOS / Android)
  if (window.Capacitor) {
    const { App, PushNotifications, StatusBar, Network } = window.Capacitor.Plugins;

    // Cấu hình thanh trạng thái (Status Bar)
    if (StatusBar) {
      StatusBar.setBackgroundColor({ color: '#0b0f19' }).catch(() => {});
    }

    // Lắng nghe mạng từ plugin Native
    if (Network) {
      Network.getStatus().then(status => setNetworkStatus(status.connected));
      Network.addListener('networkStatusChange', status => setNetworkStatus(status.connected));
    }

    // Xử lý nút Back phần cứng của Android (Tránh bị thoát app khi lùi trang)
    if (App) {
      App.addListener('backButton', () => {
        // Nếu đang mở popup quét mã -> đóng popup
        if (!scannerModal.classList.contains('hidden')) {
          closeScanner();
          return;
        }

        // Kiểm tra xem iframe có lùi được không
        try {
          if (iframe.contentWindow && iframe.contentWindow.history.length > 1) {
            iframe.contentWindow.history.back();
            return;
          }
        } catch (e) {
          // Bỏ qua lỗi cross-origin nếu có
        }

        // Nếu ở trang gốc: Bấm lần 2 trong vòng 2 giây để thoát
        const now = Date.now();
        if (now - lastBackPressTime < 2000) {
          App.exitApp();
        } else {
          lastBackPressTime = now;
          if (window.Capacitor.Plugins.Toast) {
            window.Capacitor.Plugins.Toast.show({ text: 'Nhấn lần nữa để thoát ứng dụng GAERU' });
          }
        }
      });
    }

    // Thiết lập Push Notifications (Thông báo đẩy)
    if (PushNotifications) {
      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      // Nhận Token thiết bị gửi về server GAERU
      PushNotifications.addListener('registration', token => {
        console.log('FCM / APNs Token:', token.value);
        try {
          fetch(`${GAERU_BASE_URL}/api/mobile/register-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value, platform: window.Capacitor.getPlatform() })
          }).catch(() => {});
        } catch (e) {}
      });

      // Xử lý khi người dùng chạm vào thông báo trên thanh thông báo
      PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        const data = notification.notification.data;
        if (data && data.url) {
          loadPage(data.url);
        } else if (data && data.orderId) {
          loadPage(`${GAERU_BASE_URL}/account.html?order=${data.orderId}`);
        }
      });
    }
  }

  // 6. Hiển thị danh mục sản phẩm đã đồng bộ từ web khi ngoại tuyến
  async function renderOfflineProducts() {
    const grid = document.getElementById('offline-products-grid');
    if (!grid) return;

    try {
      let products = [];
      if (window.GaeruAPI) {
        products = await window.GaeruAPI.getProducts().catch(() => []);
      }
      if (!products || products.length === 0) {
        const res = await fetch('data/products.json');
        const json = await res.json();
        products = json.products || [];
      }

      if (products.length > 0) {
        grid.innerHTML = products.map(p => `
          <div class="offline-product-card">
            <img class="offline-product-thumb" src="${p.imageUrl}" alt="${p.name}" onerror="this.src='assets/brand/gaeru-logo.png'">
            <div class="offline-product-info">
              <div class="offline-product-title">${p.name}</div>
              <div class="offline-product-desc">${p.descriptor || p.description || ''}</div>
              <div class="offline-product-meta">
                <span class="offline-product-price">${(p.priceVnd || 0).toLocaleString('vi-VN')} ₫</span>
                <a href="tel:0829191080" class="btn-sm-order">Gọi đặt hàng</a>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        grid.innerHTML = '<p style="font-size:12px;color:var(--gaeru-text-muted);">Đang kết nối danh mục thiết bị...</p>';
      }
    } catch (e) {
      console.warn('Lỗi hiển thị sản phẩm offline:', e);
    }
  }

  // Khởi động
  renderOfflineProducts();
  setNetworkStatus(navigator.onLine);
})();
