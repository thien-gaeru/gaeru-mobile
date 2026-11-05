const http = require('http');

console.log('=============================================================');
console.log('   🔍 KIỂM TRA KẾT NỐI TRỰC TIẾP CƠ SỞ DỮ LIỆU GAERU.COM');
console.log('=============================================================\n');

function makeRequest(path, method = 'GET', headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let total = 0;

  // Test 1: CSRF & Session Cookie
  total++;
  console.log('1️⃣  Kiểm tra lấy mã CSRF Token & Phiên Session từ CSDL gaeru.com...');
  try {
    const res = await makeRequest('/proxy/api/csrf');
    const cookies = res.headers['set-cookie'] || [];
    const hasSid = cookies.some(c => c.includes('gaeru.sid'));
    const isSecureStripped = cookies.every(c => !c.includes('Secure'));

    if (res.statusCode === 200 && res.json?.csrfToken && hasSid && isSecureStripped) {
      console.log('   ✅ Đã nhận CSRF Token:', res.json.csrfToken.slice(0, 16) + '...');
      console.log('   ✅ Đã nhận Cookie Session gaeru.sid (đã tối ưu HTTP cho Mobile)');
      passed++;
    } else {
      console.log('   ❌ Thất bại:', res.statusCode, res.body);
    }
  } catch(e) {
    console.log('   ❌ Lỗi kết nối:', e.message);
  }

  // Test 2: Check Session
  total++;
  console.log('\n2️⃣  Kiểm tra API tài khoản khách hàng: /api/customer-auth/me...');
  try {
    const res = await makeRequest('/proxy/api/customer-auth/me');
    if (res.statusCode === 200 && res.json && 'authenticated' in res.json) {
      console.log('   ✅ CSDL gaeru.com phản hồi trạng thái phiên: authenticated =', res.json.authenticated);
      passed++;
    } else {
      console.log('   ❌ Thất bại:', res.statusCode, res.body);
    }
  } catch(e) {
    console.log('   ❌ Lỗi kết nối:', e.message);
  }

  // Test 3: Live Orders Database Query
  total++;
  console.log('\n3️⃣  Tra cứu đơn hàng thực tế trực tiếp từ bảng orders trên CSDL gaeru.com...');
  try {
    const testOrderCode = 'GR-20261105-0404344DB3';
    const res = await makeRequest(`/proxy/api/payments/order-status?order=${testOrderCode}`);
    if (res.statusCode === 200 && res.json?.order?.orderNumber === testOrderCode) {
      console.log('   ✅ Đã tìm thấy đơn hàng thực tế trong CSDL: #' + res.json.order.orderNumber);
      console.log('   📊 Trạng thái đơn:', res.json.order.status);
      console.log('   💰 Tổng tiền:', res.json.order.totalVnd, '₫');
      console.log('   💳 Thanh toán:', res.json.order.paymentMethod);
      passed++;
    } else {
      console.log('   ❌ Thất bại:', res.statusCode, res.body);
    }
  } catch(e) {
    console.log('   ❌ Lỗi kết nối:', e.message);
  }

  // Test 4: Live Product Catalog from Database
  total++;
  console.log('\n4️⃣  Kiểm tra danh mục sản phẩm từ bảng products trên CSDL gaeru.com...');
  try {
    const res = await makeRequest('/proxy/api/products');
    const products = res.json?.products || (Array.isArray(res.json) ? res.json : []);
    if (res.statusCode === 200 && products.length > 0) {
      console.log(`   ✅ Tải thành công ${products.length} sản phẩm thực tế từ CSDL:`);
      products.forEach((p, idx) => {
        console.log(`      ${idx + 1}. ${p.name} - ${p.variants?.length || 0} biến thể`);
      });
      passed++;
    } else {
      console.log('   ❌ Thất bại:', res.statusCode, res.body);
    }
  } catch(e) {
    console.log('   ❌ Lỗi kết nối:', e.message);
  }

  console.log('\n=============================================================');
  console.log(`📋 KẾT QUẢ KIỂM TRA KẾT NỐI CSDL: ${passed}/${total} BƯỚC THÀNH CÔNG!`);
  console.log('=============================================================');
  if (passed === total) {
    console.log('✨ KẾT NỐI TRỰC TIẾP THÔNG TIN VÀ CƠ SỞ DỮ LIỆU GAERU.COM HOÀN TẤT 100%!');
  }
}

runTests();
