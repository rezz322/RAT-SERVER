/**
 * Нагрузочный тест:
 * - Загружает реальный PDF на сервер
 * - Параллельно шлёт N запросов к /api/status и /api/ping
 * - Измеряет RPS и время ответа
 * - Проверяет что сервер не зависает во время очереди APK-сборки
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const BASE_URL = 'http://localhost:8080';
const PDF_PATH = path.join(__dirname, '..', 'test-pdf', '29-05-2026.pdf');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function httpRequest(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function uploadPdf(filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + randomUUID().replace(/-/g, '');
    const filename = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    const pre = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([pre, fileData, post]);

    const options = {
      hostname: 'localhost',
      port: 8080,
      path: '/pdf/upload',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Нагрузочный тест ────────────────────────────────────────────────────────

async function runLoadTest(endpoint, concurrency, durationMs) {
  const results = { ok: 0, err: 0, times: [] };
  const end = Date.now() + durationMs;

  async function worker() {
    while (Date.now() < end) {
      const t0 = Date.now();
      try {
        const res = await httpRequest('GET', endpoint);
        if (res.status === 200) results.ok++;
        else results.err++;
      } catch {
        results.err++;
      }
      results.times.push(Date.now() - t0);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  PDF-SERVER LOAD TEST');
  console.log('═'.repeat(60));

  // 1. Health check
  console.log('\n[1] Health check...');
  const health = await httpRequest('GET', `${BASE_URL}/`);
  console.log(`    GET / → ${health.status} (${JSON.stringify(health.body)})`);

  // 2. Загружаем реальный PDF
  console.log(`\n[2] Uploading real PDF: ${path.basename(PDF_PATH)} (${(fs.statSync(PDF_PATH).size / 1024).toFixed(0)} KB)...`);
  const t0 = Date.now();
  const upload = await uploadPdf(PDF_PATH);
  const uploadTime = Date.now() - t0;
  console.log(`    Status: ${upload.status}`);
  console.log(`    Response: ${JSON.stringify(upload.body)}`);
  console.log(`    Upload time: ${uploadTime}ms`);

  const pdfId = upload.body?.pdfId;
  if (!pdfId) {
    console.error('    ✗ Upload failed — aborting test');
    process.exit(1);
  }
  console.log(`    ✓ pdfId: ${pdfId}`);

  // 3. Нагрузочный тест /api/status (пока APK в очереди сборки)
  console.log('\n[3] Load test GET /api/status (5 sec, 20 concurrent)...');
  console.log('    (сервер должен отвечать даже если APK собирается)');
  const statusResults = await runLoadTest(`${BASE_URL}/api/status`, 20, 5000);
  const statusAvg = (statusResults.times.reduce((a, b) => a + b, 0) / statusResults.times.length).toFixed(1);
  const statusRps = (statusResults.ok / 5).toFixed(0);
  console.log(`    ✓ OK: ${statusResults.ok}  ERR: ${statusResults.err}`);
  console.log(`    ✓ RPS: ${statusRps}  avg: ${statusAvg}ms  max: ${Math.max(...statusResults.times)}ms`);

  // 4. Нагрузочный тест /api/ping с разными pdfId
  console.log('\n[4] Load test POST /api/ping (5 sec, 10 concurrent)...');
  let pingOk = 0, pingErr = 0;
  const pingTimes = [];
  const pingEnd = Date.now() + 5000;

  await Promise.all(Array.from({ length: 10 }, async () => {
    while (Date.now() < pingEnd) {
      const t = Date.now();
      try {
        const body = Buffer.from(JSON.stringify({ pdf_id: pdfId }));
        const res = await httpRequest('POST', `${BASE_URL}/api/ping`, {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        }, body);
        if (res.status === 200 || res.status === 404) pingOk++;
        else pingErr++;
      } catch { pingErr++; }
      pingTimes.push(Date.now() - t);
    }
  }));

  const pingAvg = (pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length).toFixed(1);
  const pingRps = (pingOk / 5).toFixed(0);
  console.log(`    ✓ OK: ${pingOk}  ERR: ${pingErr}`);
  console.log(`    ✓ RPS: ${pingRps}  avg: ${pingAvg}ms  max: ${Math.max(...pingTimes)}ms`);

  // 5. Финальная проверка сервера
  console.log('\n[5] Final health check (сервер не завис?)...');
  const health2 = await httpRequest('GET', `${BASE_URL}/`);
  const status2 = await httpRequest('GET', `${BASE_URL}/api/status`);
  console.log(`    GET /  → ${health2.status} ✓`);
  console.log(`    GET /api/status → ${status2.status}, records: ${Array.isArray(status2.body) ? status2.body.length : '?'} ✓`);

  // 6. Результаты
  console.log('\n' + '═'.repeat(60));
  console.log('  РЕЗУЛЬТАТЫ');
  console.log('═'.repeat(60));
  console.log(`  Загрузка PDF (${(fs.statSync(PDF_PATH).size / 1024 / 1024).toFixed(2)} MB): ${uploadTime}ms`);
  console.log(`  /api/status:  ${statusRps} RPS, avg ${statusAvg}ms`);
  console.log(`  /api/ping:    ${pingRps} RPS, avg ${pingAvg}ms`);
  console.log(`  Сервер завис? ${health2.status === 200 ? 'НЕТ ✓' : 'ДА ✗'}`);
  console.log(`  pdfId: ${pdfId}`);
  console.log(`  viewUrl: ${BASE_URL}/view/${pdfId}`);
  console.log('═'.repeat(60));
}

main().catch(console.error);
