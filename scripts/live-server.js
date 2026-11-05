const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 5000;
const WWW_DIR = path.join(__dirname, '..', 'www');
const LOCAL_BACKEND = 'http://127.0.0.1:3000';
const PROD_BACKEND = 'https://gaeru.com';

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// 1. SSE clients for browser live reload (khi code HTML/CSS/JS thay đổi)
const sseClients = new Set();
function notifyLiveReload() {
  for (const client of sseClients) {
    try { client.write('data: reload\n\n'); } catch (e) { sseClients.delete(client); }
  }
}

// 2. SSE clients for App Realtime Data Channel (đồng bộ sản phẩm & thông báo)
const appRealtimeClients = new Set();
function broadcastAppEvent(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of appRealtimeClients) {
    try {
      client.write(payload);
    } catch (e) {
      appRealtimeClients.delete(client);
    }
  }
}

// Watch www folder for changes
try {
  let debounceTimer = null;
  fs.watch(WWW_DIR, { recursive: true }, (eventType, filename) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[LIVE RELOAD] Thay đổi tại: ${filename}`);
      notifyLiveReload();

      // Nếu thay đổi liên quan đến sản phẩm, gửi sự kiện realtime tới app
      if (filename && (filename.includes('products.json') || filename.includes('settings.json') || filename.includes('guides.json'))) {
        broadcastAppEvent({
          type: 'product_change',
          source: 'local_file_change',
          file: filename,
          timestamp: Date.now()
        });
      }
    }, 150);
  });
} catch (e) {
  console.warn('[WATCHER] Không thể watch tự động:', e.message);
}

// Watch thư mục nguồn web gaeru (tự động đồng bộ sang mobile khi web có thay đổi)
const WEB_SOURCE_DIR = path.resolve(__dirname, '..', '..', 'gaeru');
if (fs.existsSync(WEB_SOURCE_DIR)) {
  let webDebounceTimer = null;
  function triggerAutoSync(relPath) {
    if (webDebounceTimer) clearTimeout(webDebounceTimer);
    webDebounceTimer = setTimeout(() => {
      console.log(`[WEB AUTO-SYNC] Phát hiện thay đổi tại gaeru web: ${relPath}`);
      console.log('[WEB AUTO-SYNC] Đang tự động đồng bộ nội dung sang Mobile App...');
      try {
        const { execSync } = require('child_process');
        execSync(`node "${path.join(__dirname, 'sync-web-content.js')}"`, { stdio: 'inherit' });
        console.log('[WEB AUTO-SYNC] ✅ Đã đồng bộ hoàn tất!');
        broadcastAppEvent({
          type: 'product_change',
          source: 'gaeru_web_source_change',
          file: relPath,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('[WEB AUTO-SYNC] Lỗi đồng bộ tự động:', err.message);
      }
    }, 400);
  }

  try {
    const watchSubs = ['assets', 'content', 'brand.css'];
    for (const sub of watchSubs) {
      const fullSub = path.join(WEB_SOURCE_DIR, sub);
      if (fs.existsSync(fullSub)) {
        fs.watch(fullSub, { recursive: true }, (evt, file) => {
          if (file && !file.includes('.git')) {
            triggerAutoSync(`${sub}/${file}`);
          }
        });
      }
    }
    console.log(`[WEB AUTO-SYNC] 🟢 Đã kích hoạt theo dõi tự động thay đổi từ: ${WEB_SOURCE_DIR}`);
  } catch (err) {
    console.warn('[WEB AUTO-SYNC] Không thể kích hoạt web watcher:', err.message);
  }
}

// Heartbeat định kỳ gửi tới các kết nối realtime app (mỗi 15 giây)
setInterval(() => {
  if (appRealtimeClients.size > 0) {
    broadcastAppEvent({
      type: 'heartbeat',
      timestamp: Date.now(),
      connectedClients: appRealtimeClients.size
    });
  }
}, 15000);

// Theo dõi ngầm thay đổi ETag từ cloud gaeru.com (mỗi 25 giây)
let lastCloudETag = null;
setInterval(async () => {
  try {
    const res = await fetch(`${PROD_BACKEND}/api/products`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const etag = res.headers.get('etag');
      if (lastCloudETag && etag && lastCloudETag !== etag) {
        console.log(`[CLOUD SYNC] Phát hiện thay đổi dữ liệu từ ${PROD_BACKEND}! ETag mới: ${etag}`);
        broadcastAppEvent({
          type: 'product_change',
          source: 'gaeru_cloud_sync',
          etag: etag,
          timestamp: Date.now()
        });
      }
      lastCloudETag = etag;
    }
  } catch (e) {}
}, 25000);

// Xác định backend: Mặc định kết nối thật tới https://gaeru.com
async function getBackendUrl() {
  if (process.env.USE_LOCAL_BACKEND === 'true' || process.env.USE_LOCAL_BACKEND === '1') {
    try {
      const res = await fetch(LOCAL_BACKEND, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status === 200 || res.status === 302) {
        return LOCAL_BACKEND;
      }
    } catch (e) {}
  }
  return PROD_BACKEND;
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // 1. SSE live-reload endpoint (cho trình duyệt tự refresh)
  if (pathname === '/live-reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // 2. SSE App Realtime Data Stream endpoint (Kênh kết nối thời gian thực cho App)
  if (pathname === '/api/live-stream' || pathname === '/proxy/api/live-stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Gửi sự kiện kết nối thành công ngay tức thì
    const initialGreeting = {
      type: 'connected',
      channel: 'sse',
      server: 'gaeru-live-server',
      targetBackend: PROD_BACKEND,
      timestamp: Date.now()
    };
    res.write(`data: ${JSON.stringify(initialGreeting)}\n\n`);

    appRealtimeClients.add(res);
    req.on('close', () => appRealtimeClients.delete(res));
    return;
  }

  // 3. API Kiểm tra sức khoẻ liên kết Realtime (Healthcheck)
  if (pathname === '/api/realtime/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'healthy',
      sseActiveClients: appRealtimeClients.size,
      cloudBackend: PROD_BACKEND,
      cloudETag: lastCloudETag,
      serverTime: new Date().toISOString()
    }));
    return;
  }

  // 4. Preflight OPTIONS request cho API và proxy
  if (req.method === 'OPTIONS' && (pathname.startsWith('/proxy') || pathname.startsWith('/api/'))) {
    const clientOrigin = req.headers.origin || `http://${req.headers.host}`;
    res.writeHead(204, {
      'Access-Control-Allow-Origin': clientOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, X-CSRF-Token, Cookie, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // 5. Proxy endpoint: kết nối trực tiếp API và cơ sở dữ liệu thật gaeru.com
  if (pathname.startsWith('/proxy') || pathname.startsWith('/api/') || pathname.startsWith('/catalog-images/')) {
    const backend = await getBackendUrl();
    const targetPath = pathname.startsWith('/proxy') ? (pathname.replace(/^\/proxy/, '') || '/') : pathname;
    const targetUrl = new URL(targetPath + reqUrl.search, backend);

    try {
      const fetchHeaders = { ...req.headers };
      delete fetchHeaders.host;
      delete fetchHeaders.referer;
      delete fetchHeaders['sec-fetch-dest'];
      delete fetchHeaders['sec-fetch-mode'];
      delete fetchHeaders['sec-fetch-site'];

      let reqBody = undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          reqBody = Buffer.concat(chunks);
        }
      }

      const response = await fetch(targetUrl.href, {
        method: req.method,
        headers: fetchHeaders,
        body: reqBody,
        redirect: 'follow',
        signal: AbortSignal.timeout(12000)
      });

      const resHeaders = {};
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey !== 'x-frame-options' &&
          lowerKey !== 'content-security-policy' &&
          lowerKey !== 'content-security-policy-report-only' &&
          lowerKey !== 'content-encoding' &&
          lowerKey !== 'content-length' &&
          lowerKey !== 'set-cookie'
        ) {
          resHeaders[key] = value;
        }
      });

      // Lấy danh sách Set-Cookie từ backend
      const rawCookies = typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

      // Bỏ flag 'Secure' nếu client đang gọi qua HTTP để trình duyệt chấp nhận và gửi lại cookie session gaeru.sid
      const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted;
      if (rawCookies.length > 0) {
        resHeaders['set-cookie'] = rawCookies.map(cookieStr => {
          return !isHttps ? cookieStr.replace(/;\s*Secure/gi, '') : cookieStr;
        });
      }

      // Thêm CORS headers
      const clientOrigin = req.headers.origin || `http://${req.headers.host}`;
      resHeaders['Access-Control-Allow-Origin'] = clientOrigin;
      resHeaders['Access-Control-Allow-Credentials'] = 'true';
      resHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD';
      resHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Accept, X-CSRF-Token, Cookie, Authorization';

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        let html = await response.text();
        const baseTag = `<base href="${backend}/">`;
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>${baseTag}`);
        } else {
          html = baseTag + html;
        }
        res.writeHead(response.status, {
          ...resHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(html);
      } else {
        res.writeHead(response.status, resHeaders);
        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      }
    } catch (err) {
      res.writeHead(502, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': req.headers.origin || '*'
      });
      res.end(JSON.stringify({ error: 'Không thể kết nối máy chủ backend GAERU', detail: err.message }));
    }
    return;
  }

  // 5. Phục vụ static files từ thư mục www/
  let filePath = path.join(WWW_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WWW_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Lỗi máy chủ nội bộ: ' + err.message);
      return;
    }

    // Nếu là file HTML, tự động chèn script live-reload
    if (ext === '.html') {
      const liveReloadScript = `
        <script>
          (function() {
            try {
              var es = new EventSource('/live-reload');
              es.onmessage = function(e) {
                if (e.data === 'reload') {
                  console.log('🔄 Đang tự động tải lại...');
                  location.reload();
                }
              };
            } catch(e) {}
          })();
        </script>
      `;
      content = content.toString().replace('</body>', `${liveReloadScript}</body>`);
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(content);
  });
});

// Lấy IP mạng LAN Wi-Fi
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254.')) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, '0.0.0.0', async () => {
  const lanIp = getNetworkIp();
  const backend = await getBackendUrl();

  console.log('\n=============================================================');
  console.log('   🚀 MÁY CHỦ SỐNG (LIVE SERVER) CHO GAERU MOBILE APP');
  console.log('=============================================================');
  console.log(`  🌐 Xem trên máy tính:    http://localhost:${PORT}`);
  console.log(`  📱 Xem trên điện thoại:  http://${lanIp}:${PORT}`);
  console.log(`  🔗 Kết nối nguồn dữ liệu: ${backend}`);
  console.log(`  ⚡ Kênh Realtime SSE:     http://localhost:${PORT}/api/live-stream`);
  console.log('  ⚡ Tự động cập nhật (Live Reload) khi sửa file trong www/');
  console.log('=============================================================\n');
});
