/**
 * Script dong bo du lieu tu ma nguon backend GAERU sang ung dung Mobile
 * Lay danh muc san pham (Products), bien the (Variants), thong tin cua hang (Settings)
 */

const fs = require('fs');
const path = require('path');

const BACKEND_LOCAL = 'http://127.0.0.1:3000';
const BACKEND_PROD = 'https://gaeru.com';
const DATA_DIR = path.join(__dirname, '..', 'www', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function getAvailableBackend() {
  try {
    const res = await fetch(`${BACKEND_LOCAL}/api/products`, { method: 'HEAD', signal: AbortSignal.timeout(1500) });
    if (res.ok || res.status === 200) {
      console.log(`[CONNECT] Tim thay may chu backend noi bo: ${BACKEND_LOCAL}`);
      return BACKEND_LOCAL;
    }
  } catch (e) {}

  console.log(`[CONNECT] Su dung may chu production: ${BACKEND_PROD}`);
  return BACKEND_PROD;
}

async function syncData() {
  const backend = await getAvailableBackend();
  console.log('--- Bat dau dong bo du lieu lap trinh cho App GAERU ---');

  try {
    // 1. Dong bo danh sach san pham
    console.log(`-> Dang tai danh sach san pham tu ${backend}/api/products ...`);
    const prodRes = await fetch(`${backend}/api/products`, { headers: { 'Accept': 'application/json' } });
    if (prodRes.ok) {
      const prodData = await prodRes.json();
      const prodPath = path.join(DATA_DIR, 'products.json');
      fs.writeFileSync(prodPath, JSON.stringify(prodData, null, 2), 'utf-8');
      console.log(`[THANH CONG] Da luu ${prodData.products ? prodData.products.length : 0} san pham vao: www/data/products.json`);
    } else {
      console.warn(`[CANH BAO] Khong the tai products: HTTP ${prodRes.status}`);
    }

    // 2. Dong bo thong tin cua hang & hotline
    console.log(`-> Dang tai thong tin cua hang tu ${backend}/api/settings/public ...`);
    const setRes = await fetch(`${backend}/api/settings/public`, { headers: { 'Accept': 'application/json' } });
    if (setRes.ok) {
      const setData = await setRes.json();
      const setPath = path.join(DATA_DIR, 'settings.json');
      fs.writeFileSync(setPath, JSON.stringify(setData, null, 2), 'utf-8');
      console.log(`[THANH CONG] Da luu cau hinh cua hang vao: www/data/settings.json`);
    }

    console.log('\n=== DONG BO DU LIEU THANH CONG! ===');
    console.log('App di dong bay gio co the doc truc tiep offline cache tu www/data/*.json');

  } catch (error) {
    console.error('[LOI DONG BO]', error.message);
  }
}

syncData();
