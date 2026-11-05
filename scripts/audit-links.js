const fs = require('fs');

const html = fs.readFileSync('www/index.html', 'utf8');
const appJs = fs.readFileSync('www/app.js', 'utf8');
const apiJs = fs.readFileSync('www/api-client.js', 'utf8');

console.log('=============================================================');
console.log('       🔍 KIỂM TRA TÍNH LIÊN KẾT DOM & EVENT HANDLERS        ');
console.log('=============================================================');

// 1. Trích xuất tất cả ID trong HTML
const idRegex = /id=["']([^"']+)["']/g;
const idSet = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  idSet.add(match[1]);
}
console.log('1️⃣  Tổng số phần tử ID có trong index.html:', idSet.size);

// 2. Tìm tất cả document.getElementById trong JS
const getElemRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const combinedJs = appJs + '\n' + apiJs;
const usedIds = new Set();
while ((match = getElemRegex.exec(combinedJs)) !== null) {
  usedIds.add(match[1]);
}
console.log('2️⃣  Tổng số ID được truy xuất trong JavaScript:', usedIds.size);

const missingIds = [...usedIds].filter(id => !idSet.has(id));
if (missingIds.length === 0) {
  console.log('   ✅ 100% ID truy xuất đều tồn tại trên DOM HTML!');
} else {
  console.log('   ⚠️ Có các ID sau được gọi trong JS nhưng thiếu trên HTML:');
  missingIds.forEach(id => console.log('      - ' + id));
}

// 3. Tìm tất cả inline event handlers trong HTML
const handlerRegex = /on(click|submit|change|input)=["']([a-zA-Z0-9_]+)\(/g;
const handlers = new Set();
while ((match = handlerRegex.exec(html)) !== null) {
  handlers.add(match[2]);
}
console.log('\n3️⃣  Tổng số hàm inline handlers được gọi từ HTML:', handlers.size);

const missingHandlers = [...handlers].filter(fn => {
  const inAppJs = appJs.includes('function ' + fn) ||
                  appJs.includes(fn + ' =') ||
                  appJs.includes('window.' + fn) ||
                  apiJs.includes('function ' + fn);
  return !inAppJs;
});

if (missingHandlers.length === 0) {
  console.log('   ✅ 100% Event handlers được định nghĩa đầy đủ!');
} else {
  console.log('   ⚠️ Có các hàm sau được gọi từ HTML nhưng chưa định nghĩa:');
  missingHandlers.forEach(fn => console.log('      - ' + fn));
}

// 4. Kiểm tra các Tab chuyển đổi
console.log('\n4️⃣  Kiểm tra 4 Tab giao diện chính:');
const expectedTabs = ['tab-home', 'tab-products', 'tab-care', 'tab-account'];
expectedTabs.forEach(t => {
  const hasInHtml = idSet.has(t);
  const hasNavBtn = html.includes(`data-tab="${t}"`);
  console.log(`   - Tab "${t}": ID = ${hasInHtml ? '✅' : '❌'}, Nav Button = ${hasNavBtn ? '✅' : '❌'}`);
});

// 5. Kiểm tra Modals
console.log('\n5️⃣  Kiểm tra các Modal chức năng:');
const expectedModals = [
  'product-detail-modal',
  'instant-order-modal',
  'order-success-modal',
  'guide-detail-modal',
  'auth-modal',
  'order-detail-modal'
];
expectedModals.forEach(m => {
  console.log(`   - Modal "${m}": ${idSet.has(m) ? '✅ Tồn tại' : '❌ Thiếu'}`);
});
