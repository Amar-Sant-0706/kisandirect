const http = require('http');

function fetchPath(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function verifyLiveServer() {
  console.log('==================================================================');
  console.log('E2E VERIFICATION: KISANDIRECT AI UNIFIED PRODUCTION SERVER');
  console.log('Target: http://localhost:3000');
  console.log('==================================================================');

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
    // 1. Root route '/'
    const root = await fetchPath('/');
    assert(root.status === 200, 'GET / returns HTTP 200 OK');
    assert(root.body.includes('<div id="app"></div>'), 'GET / contains #app mounting container');
    assert(root.body.includes('/src/router.js'), 'GET / loads ES module router');

    // 2. Client-side catch-all routing without 404
    const farmer = await fetchPath('/farmer/dashboard');
    assert(farmer.status === 200 && farmer.body.includes('id="app"'), 'GET /farmer/dashboard returns HTTP 200 with index.html (Catch-all active)');

    const buyer = await fetchPath('/buyer/marketplace');
    assert(buyer.status === 200 && buyer.body.includes('id="app"'), 'GET /buyer/marketplace returns HTTP 200 with index.html (Catch-all active)');

    const owner = await fetchPath('/owner/control-room');
    assert(owner.status === 200 && owner.body.includes('id="app"'), 'GET /owner/control-room returns HTTP 200 with index.html (Catch-all active)');

    const auth = await fetchPath('/auth/login?role=farmer');
    assert(auth.status === 200 && auth.body.includes('id="app"'), 'GET /auth/login returns HTTP 200 with index.html (Catch-all active)');

    // 3. Splash view and role gateway assets
    const splashView = await fetchPath('/src/views/splash/splashView.js');
    assert(splashView.status === 200, 'GET /src/views/splash/splashView.js returns HTTP 200');
    assert(splashView.body.includes('splashSequence'), 'Splash sequence contains animated splash sequence');
    assert(splashView.body.includes('cardFarmer') && splashView.body.includes('cardBuyer') && splashView.body.includes('cardOwner'), 'Splash view contains Farmer, Buyer, and Owner role gateway cards');
    assert(splashView.body.includes('pulseLogo'), 'Splash view contains animated pulse logo keyframe');

    // 4. Stylesheet asset
    const css = await fetchPath('/src/styles/portals.css');
    assert(css.status === 200 && css.body.includes('--farmer-accent'), 'GET /src/styles/portals.css served with full theme design system');

    // 5. Health API
    const health = await fetchPath('/api/health');
    assert(health.status === 200, 'GET /api/health returns HTTP 200');
    const healthJson = JSON.parse(health.body);
    assert(healthJson.status === 'online', `Server health status is "${healthJson.status}"`);

    console.log('==================================================================');
    console.log(`LIVE SERVER E2E SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('==================================================================');

    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Error connecting to live server:', err.message);
    process.exit(1);
  }
}

verifyLiveServer();
