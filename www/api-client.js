/**
 * GAERU Mobile API Client & Real-time Sync Engine
 * Module kết nối dữ liệu lập trình trực tiếp với Backend mã nguồn gaeru.com
 */

const GaeruAPI = (function () {
  const isNative = !!window.Capacitor;
  const BASE_URL = isNative
    ? 'https://gaeru.com'
    : (window.location.origin && window.location.protocol.startsWith('http') ? `${window.location.origin}/proxy` : 'https://gaeru.com');

  /**
   * Helper thực hiện request kèm fallback cache offline
   */
  async function requestWithFallback(endpoint, cacheFile) {
    // 1. Thử gọi trực tiếp API từ backend gaeru.com
    if (navigator.onLine) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          const data = await response.json();
          try {
            localStorage.setItem(`gaeru_cache_${endpoint}`, JSON.stringify(data));
          } catch (e) {}
          return { data, source: 'network' };
        }
      } catch (err) {
        console.warn(`[API] Không thể lấy dữ liệu mạng cho ${endpoint}:`, err.message);
      }
    }

    // 2. Fallback: Lấy từ LocalStorage cache
    try {
      const cached = localStorage.getItem(`gaeru_cache_${endpoint}`);
      if (cached) {
        return { data: JSON.parse(cached), source: 'local_storage' };
      }
    } catch (e) {}

    // 3. Fallback: Đọc từ file JSON đóng gói sẵn trong App
    if (cacheFile) {
      try {
        const fileRes = await fetch(cacheFile);
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          return { data: fileData, source: 'bundled_file' };
        }
      } catch (e) {}
    }

    throw new Error(`Không thể lấy dữ liệu cho ${endpoint} (Thiết bị đang ngoại tuyến)`);
  }

  return {
    baseUrl: BASE_URL,

    /**
     * Lấy danh sách toàn bộ sản phẩm GAERU
     */
    async getProducts() {
      const res = await requestWithFallback('/api/products', 'data/products.json');
      return res.data.products || [];
    },

    /**
     * Lấy chi tiết sản phẩm theo slug
     */
    async getProductBySlug(slug) {
      const res = await requestWithFallback(`/api/products/${encodeURIComponent(slug)}`, null);
      return res.data.product || res.data;
    },

    /**
     * Lấy cấu hình cửa hàng, hotline, vận chuyển và thanh toán
     */
    async getSettings() {
      const res = await requestWithFallback('/api/settings/public', 'data/settings.json');
      return res.data;
    },

    /**
     * Lấy mã bảo mật CSRF Token từ máy chủ gaeru.com
     */
    async getCsrfToken() {
      try {
        const res = await fetch(`${BASE_URL}/api/csrf`, {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.timeout(4000)
        });
        if (res.ok) {
          const json = await res.json();
          return json.csrfToken;
        }
      } catch (e) {
        console.warn('[API] Không thể lấy CSRF Token:', e.message);
      }
      return null;
    },

    /**
     * Gửi đơn đặt hàng trực tiếp từ app lên máy chủ gaeru.com
     */
    async createOrder(orderPayload) {
      const csrf = await this.getCsrfToken();
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }

      const response = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(10000)
      });

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(resJson.error || resJson.message || `Lỗi đặt hàng (HTTP ${response.status})`);
      }

      return resJson;
    },

    /**
     * Kiểm tra bảo hành GAERU Care+ theo mã Serial
     */
    async checkWarranty(serial) {
      const response = await fetch(`${BASE_URL}/api/warranty/check?serial=${encodeURIComponent(serial)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    },

    /**
     * Đồng bộ tức thì toàn bộ dữ liệu mới nhất từ gaeru.com (Live Data Sync)
     */
    async syncNow() {
      if (!navigator.onLine) {
        throw new Error('Thiết bị đang ngoại tuyến, không thể kết nối tới gaeru.com');
      }

      const [productsRes, settingsRes] = await Promise.allSettled([
        fetch(`${BASE_URL}/api/products`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }),
        fetch(`${BASE_URL}/api/settings/public`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) })
      ]);

      let freshProducts = null;
      let freshSettings = null;

      if (productsRes.status === 'fulfilled' && productsRes.value.ok) {
        const prodData = await productsRes.value.json();
        freshProducts = prodData.products || prodData;
        try {
          localStorage.setItem('gaeru_cache_/api/products', JSON.stringify(prodData));
        } catch (e) {}
      }

      if (settingsRes.status === 'fulfilled' && settingsRes.value.ok) {
        freshSettings = await settingsRes.value.json();
        try {
          localStorage.setItem('gaeru_cache_/api/settings/public', JSON.stringify(freshSettings));
        } catch (e) {}
      }

      return {
        products: freshProducts,
        settings: freshSettings,
        syncedAt: new Date().toISOString()
      };
    },

    /**
     * Kiểm tra trạng thái và chất lượng liên kết Realtime với gaeru.com
     */
    async checkRealtimeHealth() {
      const start = performance.now();
      try {
        const res = await fetch(`${BASE_URL}/api/products`, {
          method: 'HEAD',
          cache: 'no-store',
          signal: AbortSignal.timeout(6000)
        });
        const latency = Math.round(performance.now() - start);
        const etag = res.headers.get('etag');
        return {
          ok: res.ok,
          status: res.status,
          latencyMs: latency,
          etag: etag,
          backend: BASE_URL,
          isOnline: navigator.onLine,
          timestamp: Date.now()
        };
      } catch (err) {
        return {
          ok: false,
          error: err.message,
          latencyMs: Math.round(performance.now() - start),
          backend: BASE_URL,
          isOnline: navigator.onLine,
          timestamp: Date.now()
        };
      }
    },

    /**
     * Đăng ký kênh kết nối thời gian thực (Dual-Engine Realtime Architecture)
     * - Kênh 1: Server-Sent Events (SSE) stream (/api/live-stream).
     * - Kênh 2: Adaptive Differential ETag Sync (nhận diện thay đổi giá/sản phẩm tức thì, 0-byte payload).
     * - Tự động đánh thức tức thì khi người dùng mở lại app (Instant Focus Wakeup).
     */
    subscribeRealtimeUpdates(onEvent) {
      if (typeof window === 'undefined') return () => {};

      let eventSource = null;
      let diffTimer = null;
      let isStopped = false;
      let lastKnownEtag = null;
      let activeChannel = 'connecting';

      // 1. Khởi chạy Differential ETag Engine (đo nhịp tim & phát hiện thay đổi tức thì)
      async function checkDifferentialUpdate() {
        if (isStopped || !navigator.onLine || document.hidden) return;
        
        const startTime = performance.now();
        try {
          const headRes = await fetch(`${BASE_URL}/api/products`, {
            method: 'HEAD',
            cache: 'no-store',
            signal: AbortSignal.timeout(6000)
          });

          const latencyMs = Math.round(performance.now() - startTime);

          if (headRes.ok) {
            const currentEtag = headRes.headers.get('etag');

            // Gửi sự kiện nhịp tim định kỳ kèm độ trễ mạng thực tế
            if (onEvent) {
              onEvent({
                type: 'heartbeat',
                channel: activeChannel,
                latencyMs: latencyMs,
                etag: currentEtag,
                timestamp: Date.now()
              });
            }

            // Nếu ETag thay đổi -> máy chủ gaeru.com vừa cập nhật sản phẩm/giá/tồn kho
            if (lastKnownEtag && currentEtag && lastKnownEtag !== currentEtag) {
              console.log(`[Realtime Sync] Phát hiện thay đổi dữ liệu từ gaeru.com! (ETag: ${currentEtag})`);
              lastKnownEtag = currentEtag;
              if (onEvent) {
                onEvent({
                  type: 'product_change',
                  source: 'etag_differential',
                  etag: currentEtag,
                  latencyMs: latencyMs,
                  timestamp: Date.now()
                });
              }
            } else if (currentEtag) {
              lastKnownEtag = currentEtag;
            }
          }
        } catch (e) {
          // Bỏ qua lỗi ngắt kết nối mạng tạm thời
        }
      }

      function scheduleDiffPolling(intervalMs = 12000) {
        if (diffTimer) clearInterval(diffTimer);
        if (isStopped) return;
        diffTimer = setInterval(checkDifferentialUpdate, intervalMs);
      }

      // 2. Thử mở kết nối Server-Sent Events (SSE)
      if (window.EventSource && navigator.onLine) {
        try {
          eventSource = new EventSource(`${BASE_URL}/api/live-stream`);

          eventSource.onopen = () => {
            activeChannel = 'sse';
            if (onEvent) {
              onEvent({
                type: 'connected',
                channel: 'sse',
                backend: BASE_URL,
                timestamp: Date.now()
              });
            }
            // Khi có luồng SSE liên tục, giãn tần suất differential polling xuống 30s
            scheduleDiffPolling(30000);
          };

          eventSource.onmessage = (e) => {
            try {
              const payload = JSON.parse(e.data);
              if (onEvent) onEvent(payload);
            } catch (err) {
              console.warn('[Realtime SSE] Lỗi parse dữ liệu:', err);
            }
          };

          eventSource.onerror = () => {
            activeChannel = 'smart_polling';
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            // Kích hoạt Smart Differential Polling (12s) khi SSE máy chủ cloud đóng
            if (onEvent) {
              onEvent({
                type: 'connected',
                channel: 'smart_polling',
                backend: BASE_URL,
                timestamp: Date.now()
              });
            }
            checkDifferentialUpdate();
            scheduleDiffPolling(12000);
          };
        } catch (e) {
          activeChannel = 'smart_polling';
          scheduleDiffPolling(12000);
        }
      } else {
        activeChannel = 'smart_polling';
        scheduleDiffPolling(12000);
      }

      // 3. Cơ chế đánh thức tức thì khi người dùng quay lại màn hình hoặc có mạng (Instant Focus Wakeup)
      const handleWakeup = () => {
        if (isStopped) return;
        if (!document.hidden && navigator.onLine) {
          checkDifferentialUpdate();
        }
      };

      document.addEventListener('visibilitychange', handleWakeup);
      window.addEventListener('online', handleWakeup);
      window.addEventListener('focus', handleWakeup);

      // Nếu chạy trên Capacitor Native (iOS / Android)
      if (window.Capacitor && window.Capacitor.Plugins?.App) {
        try {
          window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
            if (state.isActive) handleWakeup();
          });
        } catch (e) {}
      }

      // Kích hoạt 1 lần kiểm tra ban đầu ngay khi gọi hàm
      setTimeout(checkDifferentialUpdate, 600);

      // Trả về hàm hủy đăng ký kết nối
      return function unsubscribe() {
        isStopped = true;
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (diffTimer) {
          clearInterval(diffTimer);
          diffTimer = null;
        }
        document.removeEventListener('visibilitychange', handleWakeup);
        window.removeEventListener('online', handleWakeup);
        window.removeEventListener('focus', handleWakeup);
      };
    }
  };
})();

// Export cho browser và module
if (typeof window !== 'undefined') {
  window.GaeruAPI = GaeruAPI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GaeruAPI;
}
