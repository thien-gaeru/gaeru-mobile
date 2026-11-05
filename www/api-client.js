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
      return await this.lookupWarranty(serial);
    },

    /**
     * Kiểm tra trạng thái phiên đăng nhập tài khoản thực tế từ CSDL gaeru.com
     */
    async checkSession() {
      try {
        const res = await fetch(`${BASE_URL}/api/customer-auth/me`, {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          return {
            authenticated: Boolean(data.authenticated),
            customer: data.customer || null
          };
        }
      } catch (err) {
        console.warn('[API] Lỗi kiểm tra phiên tài khoản:', err.message);
      }
      return { authenticated: false, customer: null };
    },

    /**
     * Đăng nhập trực tiếp vào cơ sở dữ liệu gaeru.com (bằng Email hoặc Số điện thoại)
     */
    async login(identifier, password) {
      const csrf = await this.getCsrfToken();
      const res = await fetch(`${BASE_URL}/api/customer-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ identifier, password }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Email, số điện thoại hoặc mật khẩu không chính xác.');
      }
      return data;
    },

    /**
     * Đăng ký tài khoản mới trực tiếp vào bảng customers trên CSDL gaeru.com
     */
    async register(fullName, email, phone, password) {
      const csrf = await this.getCsrfToken();
      const res = await fetch(`${BASE_URL}/api/customer-auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ fullName, email, phone, password }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký tài khoản chưa thành công.');
      }
      return data;
    },

    /**
     * Đăng xuất phiên làm việc khỏi máy chủ gaeru.com
     */
    async logout() {
      try {
        const csrf = await this.getCsrfToken();
        await fetch(`${BASE_URL}/api/customer-auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-Token': csrf } : {})
          },
          credentials: 'include'
        });
      } catch (e) {}
      return true;
    },

    /**
     * Lấy danh sách toàn bộ đơn hàng thực tế của tài khoản từ bảng orders
     */
    async getCustomerOrders() {
      try {
        const res = await fetch(`${BASE_URL}/api/customer/orders`, {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
          const data = await res.json();
          return data.orders || [];
        }
      } catch (err) {
        console.warn('[API] Không thể tải danh sách đơn hàng từ CSDL gaeru.com:', err.message);
      }
      return [];
    },

    /**
     * Tra cứu trạng thái đơn hàng thời gian thực từ bảng orders trên CSDL gaeru.com
     */
    async getOrderLiveStatus(orderNumber) {
      if (!orderNumber) return null;
      try {
        const cleanNumber = orderNumber.replace(/#/g, '').trim();
        const res = await fetch(`${BASE_URL}/api/payments/order-status?order=${encodeURIComponent(cleanNumber)}`, {
          credentials: 'include',
          cache: 'no-store',
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const data = await res.json();
          return data.order || null;
        }
      } catch (err) {
        console.warn('[API] Lỗi tra cứu đơn hàng realtime:', err.message);
      }
      return null;
    },

    /**
     * Tra cứu thông tin bảo hành thiết bị / đơn hàng trực tiếp trên CSDL gaeru.com
     */
    async lookupWarranty(code) {
      if (!code) return { found: false, error: 'Vui lòng nhập mã đơn hoặc số serial' };
      const cleanCode = code.replace(/#/g, '').trim().toUpperCase();

      // 1. Kiểm tra đơn hàng trực tiếp trên bảng orders
      const order = await this.getOrderLiveStatus(cleanCode);
      if (order) {
        return {
          found: true,
          type: 'order',
          code: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalVnd: order.totalVnd,
          updatedAt: order.updatedAt,
          warrantyMonths: 12,
          isGenuine: true
        };
      }

      // 2. Thử kiểm tra danh sách bảo hành nếu tài khoản đã đăng nhập
      try {
        const wRes = await fetch(`${BASE_URL}/api/customer/warranties`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (wRes.ok) {
          const wData = await wRes.json();
          const match = (wData.warranties || []).find(w => 
            (w.serial && w.serial.toUpperCase() === cleanCode) ||
            (w.orderNumber && w.orderNumber.toUpperCase() === cleanCode)
          );
          if (match) {
            return {
              found: true,
              type: 'warranty',
              code: match.serial || match.orderNumber,
              productName: match.productName || 'Thiết bị GAERU chính hãng',
              status: match.status,
              expiresOn: match.expiresOn,
              isGenuine: true
            };
          }
        }
      } catch (e) {}

      return { found: false };
    },

    /**
     * Lấy danh sách thiết bị bảo hành của khách hàng từ CSDL
     */
    async getCustomerWarranties() {
      try {
        const res = await fetch(`${BASE_URL}/api/customer/warranties`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          return data.warranties || [];
        }
      } catch (e) {}
      return [];
    },

    /**
     * Lấy danh bạ địa chỉ nhận hàng của khách hàng từ bảng customer_addresses
     */
    async getCustomerAddresses() {
      try {
        const res = await fetch(`${BASE_URL}/api/customer/addresses`, {
          credentials: 'include',
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          return data.addresses || [];
        }
      } catch (e) {}
      return [];
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
