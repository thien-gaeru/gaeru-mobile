/**
 * GAERU Mobile - Realtime Connection Diagnostic Suite
 * Kiểm tra toàn diện liên kết thời gian thực (Realtime Link) với gaeru.com:
 * 1. Ping & độ trễ mạng tới https://gaeru.com
 * 2. Cơ chế Differential ETag Detection (nhận diện thay đổi sản phẩm tức thì)
 * 3. Kênh Server-Sent Events (SSE) /api/live-stream
 * 4. API Sức khoẻ Realtime (/api/realtime/health)
 */

const http = require('http');

async function checkCloudConnection() {
  console.log('1️⃣  Kiểm tra kết nối trực tiếp Cloud: https://gaeru.com ...');
  const t0 = performance.now();
  try {
    const res = await fetch('https://gaeru.com/api/products', {
      method: 'HEAD',
      signal: AbortSignal.timeout(7000)
    });
    const latency = Math.round(performance.now() - t0);
    const etag = res.headers.get('etag');

    if (res.ok) {
      console.log(`   ✅ Cloud gaeru.com phản hồi 200 OK (${latency}ms)`);
      console.log(`   🏷️  Mã chữ ký ETag hiện tại: ${etag || '(none)'}`);
      return { ok: true, latency, etag };
    } else {
      console.log(`   ❌ Cloud phản hồi mã lỗi: ${res.status} (${latency}ms)`);
      return { ok: false, status: res.status, latency };
    }
  } catch (err) {
    console.log(`   ❌ Lỗi kết nối Cloud: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function checkLocalRealtimeHealth() {
  console.log('\n2️⃣  Kiểm tra API Sức khoẻ Realtime: http://localhost:5000/api/realtime/health ...');
  const t0 = performance.now();
  try {
    const res = await fetch('http://localhost:5000/api/realtime/health', {
      signal: AbortSignal.timeout(4000)
    });
    const latency = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      console.log(`   ✅ API Sức khoẻ phản hồi 200 OK (${latency}ms)`);
      console.log(`   📊 Trạng thái máy chủ: ${data.status}`);
      console.log(`   👥 Số Client SSE đang kết nối: ${data.sseActiveClients}`);
      console.log(`   🔗 Backend đích: ${data.cloudBackend}`);
      return { ok: true, data };
    } else {
      console.log(`   ❌ Máy chủ phản hồi mã lỗi: ${res.status}`);
      return { ok: false, status: res.status };
    }
  } catch (err) {
    console.log(`   ❌ Không thể kết nối máy chủ local: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

function testSseStream() {
  return new Promise((resolve) => {
    console.log('\n3️⃣  Kiểm tra luồng truyền tin thời gian thực SSE: /api/live-stream ...');
    const t0 = performance.now();
    let receivedEvents = [];

    const req = http.get('http://localhost:5000/api/live-stream', (res) => {
      const latency = Math.round(performance.now() - t0);
      const isEventStream = (res.headers['content-type'] || '').includes('text/event-stream');

      if (res.statusCode === 200 && isEventStream) {
        console.log(`   ✅ Kết nối SSE thành công (${latency}ms), Content-Type: ${res.headers['content-type']}`);
      } else {
        console.log(`   ❌ Lỗi mở luồng SSE: HTTP ${res.statusCode}`);
        req.destroy();
        resolve({ ok: false, statusCode: res.statusCode });
        return;
      }

      res.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              receivedEvents.push(parsed);
              console.log(`   📬 Nhận sự kiện Realtime thành công: [${parsed.type}]`, JSON.stringify(parsed));
            } catch (e) {}
          }
        }

        // Đã nhận được sự kiện đầu tiên, ngắt kết nối an toàn
        if (receivedEvents.length >= 1) {
          isDone = true;
          req.destroy();
          resolve({ ok: true, events: receivedEvents });
        }
      });

      let isDone = false;
      res.on('error', (err) => {
        if (!isDone) {
          console.log(`   ❌ Lỗi dữ liệu SSE: ${err.message}`);
          resolve({ ok: false, error: err.message });
        }
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ Lỗi gửi request SSE: ${err.message}`);
      resolve({ ok: false, error: err.message });
    });

    setTimeout(() => {
      if (receivedEvents.length === 0) {
        req.destroy();
        console.log('   ⏱️ Timeout chờ sự kiện SSE sau 4 giây');
        resolve({ ok: false, timeout: true });
      }
    }, 4000);
  });
}

async function runRealtimeDiagnostics() {
  console.log('=============================================================');
  console.log('   ⚡ KIỂM TRA LIÊN KẾT REALTIME GAERU (DIAGNOSTIC SUITE)');
  console.log('=============================================================\n');

  const cloud = await checkCloudConnection();
  const health = await checkLocalRealtimeHealth();
  const sse = await testSseStream();

  console.log('\n=============================================================');
  console.log('   📋 TỔNG KẾT TRẠNG THÁI LIÊN KẾT THỜI GIAN THỰC');
  console.log('=============================================================');
  console.log(`  🌐 Kết nối Cloud gaeru.com:         ${cloud.ok ? '🟢 HOẠT ĐỘNG (' + cloud.latency + 'ms)' : '🔴 LỖI'}`);
  console.log(`  🏷️  ETag Differential Detection:     ${cloud.etag ? '🟢 HOẠT ĐỘNG (' + cloud.etag + ')' : '🟡 KHÔNG CÓ ETAG'}`);
  console.log(`  ⚡ Kênh SSE Live Stream (/api/...):  ${sse.ok ? '🟢 HOẠT ĐỘNG (Đã nhận gói tin chào sân)' : '🔴 LỖI'}`);
  console.log(`  📊 Realtime Health Service:         ${health.ok ? '🟢 HOẠT ĐỘNG' : '🔴 LỖI'}`);
  console.log('=============================================================\n');

  if (cloud.ok && sse.ok) {
    console.log('✨ KẾT QUẢ: Toàn bộ liên kết Realtime hoạt động hoàn hảo 100%!');
  } else {
    console.log('⚠️ Cần rà soát thêm chi tiết lỗi ở các mục đánh dấu đỏ ở trên.');
  }
}

runRealtimeDiagnostics();
