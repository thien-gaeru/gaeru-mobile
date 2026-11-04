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

// SSE clients for live reload
const sseClients = new Set();

function notifyClients() {
  for (const client of sseClients) {
    client.write('data: reload\n\n');
  }
}

// Watch www folder for changes
try {
  let debounceTimer = null;
  fs.watch(WWW_DIR, { recursive: true }, (eventType, filename) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[LIVE RELOAD] Thay đổi tại: ${filename}`);
      notifyClients();
    }, 150);
  });
} catch (e) {
  console.warn('[WATCHER] Không thể watch tự động:', e.message);
}

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

  // 1. SSE live-reload endpoint
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

  // 2. Proxy endpoint: kết nối API và nhúng web thật gaeru.com mà không bị CORS / X-Frame-Options
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
          lowerKey !== 'content-length'
        ) {
          resHeaders[key] = value;
        }
      });

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
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Không thể kết nối máy chủ backend GAERU', detail: err.message }));
    }
    return;
  }

  // 3. Phục vụ static files từ thư mục www/
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
  console.log('  ⚡ Tự động cập nhật (Live Reload) khi sửa file trong www/');
  console.log('=============================================================\n');
});
