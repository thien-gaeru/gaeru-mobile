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
     * Gửi đơn đặt hàng trực tiếp từ app lên máy chủ gaeru.com
     */
    async createOrder(orderPayload) {
      const response = await fetch(`${BASE_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Lỗi tạo đơn hàng (HTTP ${response.status})`);
      }

      return await response.json();
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
     * Đăng ký kênh kết nối thời gian thực (Realtime Event Channel)
     * Hỗ trợ: Server-Sent Events (SSE) + Fallback Smart Heartbeat Polling
     */
    subscribeRealtimeUpdates(onEvent) {
      if (typeof window === 'undefined') return () => {};

      let eventSource = null;
      let pollTimer = null;

      // 1. Thử mở kết nối Server-Sent Events (SSE) trực tiếp với backend
      if (window.EventSource && navigator.onLine) {
        try {
          eventSource = new EventSource(`${BASE_URL}/api/live-stream`);

          eventSource.onopen = () => {
            if (onEvent) onEvent({ type: 'connected', channel: 'sse' });
          };

          eventSource.onmessage = (e) => {
            try {
              const payload = JSON.parse(e.data);
              if (onEvent) onEvent(payload);
            } catch (err) {
              console.warn('[Realtime] Lỗi parse sự kiện:', err);
            }
          };

          eventSource.onerror = () => {
            if (eventSource) {
              eventSource.close();
              eventSource = null;
            }
            startPollingFallback();
          };
        } catch (e) {
          startPollingFallback();
        }
      } else {
        startPollingFallback();
      }

      // 2. Cơ chế Smart Heartbeat Polling (chạy mỗi 35 giây khi app đang mở và trực tuyến)
      function startPollingFallback() {
        if (pollTimer) return;
        pollTimer = setInterval(async () => {
          if (!navigator.onLine || document.hidden) return;
          try {
            const check = await fetch(`${BASE_URL}/api/products`, {
              method: 'HEAD',
              signal: AbortSignal.timeout(3500)
            });
            if (check.ok && onEvent) {
              onEvent({ type: 'heartbeat', timestamp: Date.now() });
            }
          } catch (e) {}
        }, 35000);
      }

      return function unsubscribe() {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
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
