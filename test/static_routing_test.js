const http = require('http');
const { app, server } = require('../backend/server');

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      ...options
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runStaticRoutingTests() {
  console.log("==================================================================");
  console.log("TEST: STATIC BUILD SERVING & CLIENT-SIDE CATCH-ALL ROUTING");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Root Route '/'
    const rootRes = await request({ path: '/', method: 'GET' });
    assert(rootRes.status === 200 && (rootRes.raw || '').includes('id="app"'), 'GET / serves frontend static build directly from root');

    // 2. Client-side routes (catch-all fallback test)
    const farmerRes = await request({ path: '/farmer/dashboard', method: 'GET' });
    assert(farmerRes.status === 200 && (farmerRes.raw || '').includes('id="app"'), 'GET /farmer/dashboard caught by fallback catch-all (HTTP 200, no 404)');

    const buyerRes = await request({ path: '/buyer/marketplace', method: 'GET' });
    assert(buyerRes.status === 200 && (buyerRes.raw || '').includes('id="app"'), 'GET /buyer/marketplace caught by fallback catch-all (HTTP 200, no 404)');

    const ownerRes = await request({ path: '/owner/control-room', method: 'GET' });
    assert(ownerRes.status === 200 && (ownerRes.raw || '').includes('id="app"'), 'GET /owner/control-room caught by fallback catch-all (HTTP 200, no 404)');

    const authRes = await request({ path: '/auth/login', method: 'GET' });
    assert(authRes.status === 200 && (authRes.raw || '').includes('id="app"'), 'GET /auth/login caught by fallback catch-all (HTTP 200, no 404)');

    // 3. Static CSS and JS assets
    const cssRes = await request({ path: '/src/styles/portals.css', method: 'GET' });
    assert(cssRes.status === 200 && (cssRes.raw || '').includes('--farmer-accent'), 'Static asset /src/styles/portals.css served successfully');

    const routerRes = await request({ path: '/src/router.js', method: 'GET' });
    assert(routerRes.status === 200 && (routerRes.raw || '').includes('Router'), 'Static asset /src/router.js served successfully');

    // 4. API 404 should return JSON, not HTML
    const api404Res = await request({ path: '/api/invalid-endpoint-test', method: 'GET' });
    assert(api404Res.status === 404 && api404Res.data && api404Res.data.error === 'API_ENDPOINT_NOT_FOUND', 'API 404 routes return JSON error instead of HTML fallback');

    // 5. Verify Core API Endpoints
    const healthRes = await request({ path: '/api/health', method: 'GET' });
    assert(healthRes.status === 200 && healthRes.data.status === 'online', 'GET /api/health returns online status');

    const lotsRes = await request({ path: '/api/marketplace/lots', method: 'GET' });
    assert(lotsRes.status === 200 && lotsRes.data.lots.length > 0, 'GET /api/marketplace/lots returns active produce catalog');

    const voiceRes = await request({ path: '/api/voice/briefing?lang=mr-IN', method: 'GET' });
    assert(voiceRes.status === 200 && voiceRes.data.briefing.lang === 'mr-IN', 'GET /api/voice/briefing returns Marathi voice briefing');

    console.log("==================================================================");
    console.log(`STATIC ROUTING TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================================");

    server.close();
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    server.close();
    process.exit(1);
  }
}

runStaticRoutingTests();
