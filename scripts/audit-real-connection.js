/**
 * Script rà soát kết nối thật với gaeru.com
 * Kiểm tra các API: Products, Settings, Order validation, Image resolution
 */

const https = require('https');

async function testFetch(url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(8000)
    });
    const duration = Date.now() - start;
    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { ok: res.ok, status: res.status, duration, data };
  } catch (err) {
    return { ok: false, error: err.message, duration: Date.now() - start };
  }
}

async function runAudit() {
  console.log('=============================================================');
  console.log('   🔍 RÀ SOÁT KẾT NỐI THẬT VỚI MÁY CHỦ GAERU.COM');
  console.log('=============================================================\n');

  // 1. Kiểm tra Trang chủ gaeru.com
  console.log('1️⃣  Kiểm tra máy chủ chính https://gaeru.com ...');
  const homeTest = await testFetch('https://gaeru.com');
  if (homeTest.ok) {
    console.log(`   ✅ Máy chủ phản hồi 200 OK (${homeTest.duration}ms)`);
  } else {
    console.log(`   ❌ Lỗi kết nối: ${homeTest.error || homeTest.status}`);
  }

  // 2. Kiểm tra API Cấu hình cửa hàng
  console.log('\n2️⃣  Kiểm tra API Cấu hình: /api/settings/public ...');
  const settingsTest = await testFetch('https://gaeru.com/api/settings/public');
  if (settingsTest.ok) {
    console.log(`   ✅ Cấu hình công khai tải thành công (${settingsTest.duration}ms)`);
    console.log('   📦 Dữ liệu:', JSON.stringify(settingsTest.data));
  } else {
    console.log(`   ❌ Lỗi: ${settingsTest.error || settingsTest.status}`);
  }

  // 3. Kiểm tra API Danh sách sản phẩm thật
  console.log('\n3️⃣  Kiểm tra API Sản phẩm: /api/products ...');
  const productsTest = await testFetch('https://gaeru.com/api/products');
  if (productsTest.ok && productsTest.data.products) {
    const prods = productsTest.data.products;
    console.log(`   ✅ Tải thành công ${prods.length} sản phẩm thực tế từ cơ sở dữ liệu:`);
    prods.forEach((p, idx) => {
      const price = p.variants?.[0]?.priceVnd || p.priceVnd || 0;
      const stock = p.variants?.[0]?.stockQuantity ?? 'N/A';
      console.log(`      [${idx + 1}] ${p.name} (slug: ${p.slug})`);
      console.log(`          Giá: ${price.toLocaleString('vi-VN')} ₫ | Tồn kho: ${stock} | Ảnh: ${p.imageUrl}`);
    });
  } else {
    console.log(`   ❌ Lỗi tải sản phẩm: ${productsTest.error || productsTest.status}`);
  }

  // 4. Kiểm tra tải ảnh catalog thực tế
  console.log('\n4️⃣  Kiểm tra truy cập hình ảnh CDN/Catalog ...');
  if (productsTest.ok && productsTest.data.products?.[0]?.imageUrl) {
    const sampleImgPath = productsTest.data.products[0].imageUrl;
    const fullImgUrl = sampleImgPath.startsWith('http') ? sampleImgPath : `https://gaeru.com${sampleImgPath}`;
    const imgTest = await testFetch(fullImgUrl, { method: 'HEAD' });
    if (imgTest.ok) {
      console.log(`   ✅ Ảnh catalog tải thành công từ: ${fullImgUrl} (${imgTest.duration}ms)`);
    } else {
      console.log(`   ⚠️ Ảnh catalog trả về status ${imgTest.status} tại ${fullImgUrl}`);
    }
  }

  console.log('\n=============================================================');
  console.log('   ✨ HOÀN TẤT RÀ SOÁT KẾT NỐI THỰC TẾ');
  console.log('=============================================================');
}

runAudit();
