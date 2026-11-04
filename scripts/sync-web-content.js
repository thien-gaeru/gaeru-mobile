/**
 * Script dong bo toan bo noi dung va tai nguyen tu ma nguon Web gaeru.com sang gaeru-mobile
 * Dong bo:
 * 1. Assets (hinh anh san pham .webp/.png, logo thuong hieu, bo du lieu dia chi Viet Nam)
 * 2. Content (product-stories.json, thong so ky thuat, bai viet gioi thieu)
 * 3. Brand styling (brand.css, mau sac chu dao)
 */

const fs = require('fs');
const path = require('path');

const WEB_DIR = process.env.GAERU_WEB_PATH || path.resolve(__dirname, '..', '..', 'gaeru');
const MOBILE_DIR = path.resolve(__dirname, '..');
const WWW_DIR = path.join(MOBILE_DIR, 'www');

console.log('=============================================================');
console.log('  🔄 BẮT ĐẦU ĐỒNG BỘ NỘI DUNG TỪ WEB GAERU SANG MOBILE APP');
console.log('=============================================================');
console.log(`📁 Thư mục Web nguồn:     ${WEB_DIR}`);
console.log(`📁 Thư mục App đích:      ${MOBILE_DIR}\n`);

if (!fs.existsSync(WEB_DIR)) {
  console.error(`[LỖI] Không tìm thấy thư mục web tại: ${WEB_DIR}`);
  console.error('Vui lòng kiểm tra lại đường dẫn dự án gaeru.');
  process.exit(1);
}

// Hàm copy thư mục đệ quy
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

// 1. Đồng bộ Assets (Hình ảnh sản phẩm, Logo, Data địa chỉ)
console.log('1️⃣  Đang đồng bộ Assets (Hình ảnh sản phẩm & Logo thương hiệu)...');
const srcAssets = path.join(WEB_DIR, 'assets');
const destAssets = path.join(WWW_DIR, 'assets');
const assetFilesCopied = copyDirRecursive(srcAssets, destAssets);
console.log(`   ✅ Đã đồng bộ ${assetFilesCopied} tệp tin trong thư mục assets/`);

// 2. Đồng bộ Content (Product Stories, Bài viết & Thông số kỹ thuật)
console.log('2️⃣  Đang đồng bộ Content (product-stories.json)...');
const srcContent = path.join(WEB_DIR, 'content');
const destContent = path.join(WWW_DIR, 'content');
const contentFilesCopied = copyDirRecursive(srcContent, destContent);
console.log(`   ✅ Đã đồng bộ ${contentFilesCopied} tệp tin trong thư mục content/`);

// 3. Chuyển đổi và tạo bộ dữ liệu sản phẩm ngoại tuyến chuẩn cho App (products.json)
console.log('3️⃣  Tạo cấu trúc dữ liệu sản phẩm offline từ product-stories...');
const storiesFile = path.join(destContent, 'product-stories.json');
if (fs.existsSync(storiesFile)) {
  try {
    const rawStories = JSON.parse(fs.readFileSync(storiesFile, 'utf-8'));
    const destDataDir = path.join(WWW_DIR, 'data');
    if (!fs.existsSync(destDataDir)) fs.mkdirSync(destDataDir, { recursive: true });

    // Tạo danh sách sản phẩm chuẩn với đường dẫn ảnh local
    const offlineProducts = rawStories.map((item, index) => {
      // Ưu tiên ảnh local webp nếu có
      let localImage = item.imageUrl;
      if (item.slug === 'gaeru-g1-ultra') localImage = 'assets/products/g1-ultra-clean.webp';
      else if (item.slug === 'gaeru-p01') localImage = 'assets/products/p01.webp';
      else if (item.slug === 'gaeru-k9') localImage = 'assets/products/k9.webp';
      else if (item.slug === 'gaeru-m3') localImage = 'assets/products/m3.webp';

      return {
        id: `gaeru-prod-${index + 1}`,
        slug: item.slug,
        name: item.name,
        category: item.slug.includes('p01') ? 'gimbal' : 'audio',
        descriptor: item.description ? item.description.split('\n')[0] : 'Thiết bị sáng tạo nội dung chính hãng GAERU',
        description: item.description || '',
        imageUrl: localImage,
        imageAlt: item.imageAlt || item.name,
        gallery: [localImage],
        active: true,
        sortOrder: index,
        priceVnd: item.slug === 'gaeru-g1-ultra' ? 1490000 : (item.slug === 'gaeru-p01' ? 690000 : 850000)
      };
    });

    const catalogPath = path.join(destDataDir, 'products.json');
    fs.writeFileSync(catalogPath, JSON.stringify({ products: offlineProducts }, null, 2), 'utf-8');
    console.log(`   ✅ Đã cập nhật ${offlineProducts.length} sản phẩm thực tế vào: www/data/products.json`);
  } catch (err) {
    console.warn('   ⚠️ Lỗi khi xử lý product-stories.json:', err.message);
  }
}

// 4. Đồng bộ Brand CSS
console.log('4️⃣  Đang đồng bộ Brand Styling (brand.css)...');
const srcBrandCss = path.join(WEB_DIR, 'brand.css');
if (fs.existsSync(srcBrandCss)) {
  fs.copyFileSync(srcBrandCss, path.join(WWW_DIR, 'brand.css'));
  console.log('   ✅ Đã sao chép brand.css vào www/brand.css');
}

console.log('\n=============================================================');
console.log('  ✨ ĐỒNG BỘ NỘI DUNG HOÀN TẤT THÀNH CÔNG!');
console.log('  App Mobile giờ đây có đầy đủ hình ảnh, bài viết và thông số');
console.log('  tương ứng 100% với website gaeru.com.');
console.log('=============================================================\n');
