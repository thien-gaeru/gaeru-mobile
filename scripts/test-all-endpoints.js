const BASE_URL = 'http://localhost:5000';

async function testAllSyncEndpoints() {
  console.log('=============================================================');
  console.log('   🔍 KIỂM TRA ĐỒNG BỘ TOÀN DIỆN VỚI BACKEND GAERU.COM       ');
  console.log('=============================================================');

  const tests = [
    { name: '1. Sức khỏe Realtime SSE & Proxy', path: '/api/realtime/health', method: 'GET' },
    { name: '2. CSRF Token Security', path: '/api/csrf', method: 'GET' },
    { name: '3. Cấu hình Google OAuth', path: '/api/customer-auth/oauth/config', method: 'GET' },
    { name: '4. Phiên Khách hàng (/me)', path: '/api/customer-auth/me', method: 'GET' },
    { name: '5. Danh mục Sản phẩm & Biến thể', path: '/api/products', method: 'GET' },
    { name: '6. Cẩm nang & Hướng dẫn sáng tạo', path: '/api/guides', method: 'GET' },
    { name: '7. Tin tức & Hoạt động sáng tạo', path: '/api/news', method: 'GET' },
    { name: '8. Thiết lập Thương hiệu & Bảo hành', path: '/api/settings', method: 'GET' },
    { name: '9. Tra cứu Đơn hàng mẫu #GR-20261105-0404344DB3', path: '/api/orders/GR-20261105-0404344DB3', method: 'GET' },
    { name: '10. Tra cứu Bảo hành Care+ (Serial)', path: '/api/warranty/lookup?q=GR-20261105-0404344DB3', method: 'GET' }
  ];

  let successCount = 0;

  for (const t of tests) {
    const start = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${t.path}`, {
        method: t.method,
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      const latency = Math.round(performance.now() - start);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();

      if (res.ok) {
        successCount++;
        let summary = '';
        if (Array.isArray(data)) summary = `Array (${data.length} phần tử)`;
        else if (data && typeof data === 'object') {
          const keys = Object.keys(data).slice(0, 4).join(', ');
          summary = `{ ${keys}... }`;
        }
        console.log(`✅ [${res.status} OK] ${t.name} (${latency}ms) -> ${summary}`);
      } else {
        console.log(`⚠️ [${res.status} HTTP] ${t.name} (${latency}ms): ${typeof data === 'object' ? JSON.stringify(data) : data.slice(0, 80)}`);
      }
    } catch (err) {
      console.log(`❌ [LỖI] ${t.name}: ${err.message}`);
    }
  }

  console.log('=============================================================');
  console.log(`📋 KẾT QUẢ: ${successCount}/${tests.length} Endpoint kết nối & đồng bộ hoàn hảo!`);
  console.log('=============================================================');
}

testAllSyncEndpoints();
