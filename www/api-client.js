/**
 * GAERU Mobile API Client & Offline Cache
 * Module ket noi du lieu lap trinh truc tiep voi Backend ma nguon Git GAERU
 */

const GaeruAPI = (function () {
  const isNative = !!window.Capacitor;
  const BASE_URL = isNative
    ? 'https://gaeru.com'
    : (window.location.origin && window.location.protocol.startsWith('http') ? `${window.location.origin}/proxy` : 'https://gaeru.com');

  /**
   * Helper thuc hien request kem fallback cache offline
   */
  async function requestWithFallback(endpoint, cacheFile) {
    // 1. Thu goi truc tiep API tu backend
    if (navigator.onLine) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
          const data = await response.json();
          // Luu lai vao localStorage lam bo nho dem offline
          try {
            localStorage.setItem(`gaeru_cache_${endpoint}`, JSON.stringify(data));
          } catch (e) {}
          return { data, source: 'network' };
        }
      } catch (err) {
        console.warn(`[API] Khong the lay du lieu mang cho ${endpoint}:`, err.message);
      }
    }

    // 2. Fallback: Thu lay tu LocalStorage
    try {
      const cached = localStorage.getItem(`gaeru_cache_${endpoint}`);
      if (cached) {
        return { data: JSON.parse(cached), source: 'local_storage' };
      }
    } catch (e) {}

    // 3. Fallback: Thu doc tu file JSON dong bo san trong goi app
    if (cacheFile) {
      try {
        const fileRes = await fetch(cacheFile);
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          return { data: fileData, source: 'bundled_file' };
        }
      } catch (e) {}
    }

    throw new Error(`Khong the lay du lieu cho ${endpoint} (Thiet bi dang ngoai tuyen)`);
  }

  return {
    baseUrl: BASE_URL,

    /**
     * Lay danh sach toan bo san pham GAERU
     */
    async getProducts() {
      const res = await requestWithFallback('/api/products', 'data/products.json');
      return res.data.products || [];
    },

    /**
     * Lay chi tiet san pham theo slug (vi du: micro-k9, gimbal-p01)
     */
    async getProductBySlug(slug) {
      const res = await requestWithFallback(`/api/products/${encodeURIComponent(slug)}`, null);
      return res.data.product || res.data;
    },

    /**
     * Lay cau hinh cua hang, hotline, van chuyen va thanh toan
     */
    async getSettings() {
      const res = await requestWithFallback('/api/settings/public', 'data/settings.json');
      return res.data;
    },

    /**
     * Gui don dat hang tu app
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
        throw new Error(errJson.message || `Loi tao don hang (HTTP ${response.status})`);
      }

      return await response.json();
    },

    /**
     * Kiem tra bao hanh GAERU Care+ theo ma Serial
     */
    async checkWarranty(serial) {
      const response = await fetch(`${BASE_URL}/api/warranty/check?serial=${encodeURIComponent(serial)}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    }
  };
})();

// Export cho browser va module
if (typeof window !== 'undefined') {
  window.GaeruAPI = GaeruAPI;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GaeruAPI;
}
