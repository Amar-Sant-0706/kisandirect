const http = require('http');
const { app, server } = require('../server/server');

function request(options, data, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      headers,
      ...options
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runFullSystemTest() {
  console.log("==================================================================");
  console.log("KISANDIRECT AI: COMPREHENSIVE BACKEND & RBAC SYSTEM TEST SUITE");
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

  let farmerToken, buyerToken, ownerToken;
  let createdLotId, placedOrderId;

  try {
    // 1. AUTHENTICATION & LOGIN TESTS
    console.log("\n--- Phase 1: Authentication & Role Tokens ---");
    
    // Farmer Login
    const farmerRes = await request({ path: '/api/v1/auth/login', method: 'POST' }, {
      email: 'farmer@kisandirect.gov.in',
      password: 'farmer123'
    });
    assert(farmerRes.status === 200 && farmerRes.data.token, 'Farmer logged in successfully');
    assert(farmerRes.data.user.role === 'farmer', 'Farmer token contains role "farmer"');
    farmerToken = farmerRes.data.token;

    // Buyer Login
    const buyerRes = await request({ path: '/api/v1/auth/login', method: 'POST' }, {
      email: 'procurement@reliancefresh.com',
      password: 'buyer123'
    });
    assert(buyerRes.status === 200 && buyerRes.data.token, 'Buyer logged in successfully');
    assert(buyerRes.data.user.role === 'buyer', 'Buyer token contains role "buyer"');
    buyerToken = buyerRes.data.token;

    // Owner Login
    const ownerRes = await request({ path: '/api/v1/auth/login', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      password: 'owner123'
    });
    assert(ownerRes.status === 200 && ownerRes.data.token, 'Platform Owner logged in successfully');
    assert(ownerRes.data.user.role === 'owner', 'Owner token contains role "owner"');
    ownerToken = ownerRes.data.token;

    // Session validation GET /api/v1/auth/me
    const meRes = await request({ path: '/api/v1/auth/me', method: 'GET' }, null, farmerToken);
    assert(meRes.status === 200 && meRes.data.user.email === 'farmer@kisandirect.gov.in', 'Session validated via /api/v1/auth/me');

    // 2. STRICT ROLE ISOLATION (RBAC) TESTS
    console.log("\n--- Phase 2: Strict Zero-Leakage RBAC Isolation ---");

    // Farmer attempting Owner endpoint -> 403 Forbidden
    const leak1 = await request({ path: '/api/v1/admin/transactions/pending', method: 'GET' }, null, farmerToken);
    assert(leak1.status === 403, 'RBAC Block: Farmer cannot access Owner pending transactions (HTTP 403)');

    // Buyer attempting Farmer lot posting -> 403 Forbidden
    const leak2 = await request({ path: '/api/v1/farmer/batches', method: 'POST' }, {
      crop_name: 'Unauthorized Crop',
      quantity_kg: 100,
      farmgate_price: 20
    }, buyerToken);
    assert(leak2.status === 403, 'RBAC Block: Buyer cannot post harvest crop batches (HTTP 403)');

    // Farmer attempting Buyer checkout -> 403 Forbidden
    const leak3 = await request({ path: '/api/v1/orders/checkout', method: 'POST' }, {
      quantity: 50
    }, farmerToken);
    assert(leak3.status === 403, 'RBAC Block: Farmer cannot execute Buyer checkout (HTTP 403)');

    // 3. FARMER HARVEST BATCH LISTING & ESCROW EARNINGS
    console.log("\n--- Phase 3: Farmer Producer Workflows ---");
    const newBatch = {
      crop_name: 'Pimpalgaon Premium Red Onion',
      variety: 'Garwa Pink',
      quantity_kg: 500,
      farmgate_price: 26.50,
      qc_grade: 'Grade A+',
      location: 'Pimpalgaon Baswant, Nashik, MH'
    };
    const batchRes = await request({ path: '/api/v1/farmer/batches', method: 'POST' }, newBatch, farmerToken);
    assert(batchRes.status === 201 && batchRes.data.batch.lot_id, 'Farmer created harvest batch with Lot ID');
    assert(batchRes.data.batch.qc_hash.startsWith('SHA256:'), 'Batch has tamper-proof SHA-256 QC Hash');
    createdLotId = batchRes.data.batch.lot_id;

    // List Farmer Batches
    const farmerBatches = await request({ path: '/api/v1/farmer/batches', method: 'GET' }, null, farmerToken);
    assert(farmerBatches.status === 200 && farmerBatches.data.batches.length > 0, `Farmer retrieved ${farmerBatches.data.batches.length} own batches`);

    // Farmer Payouts
    const payoutsRes = await request({ path: '/api/v1/farmer/payouts', method: 'GET' }, null, farmerToken);
    assert(payoutsRes.status === 200 && payoutsRes.data.summary.payoutMethod.includes('T+1'), 'Farmer retrieved T+1 Escrow payout summary');

    // 4. BUYER CATALOG BROWSE & CHECKOUT
    console.log("\n--- Phase 4: Buyer E-Commerce & Checkout ---");
    const catalog = await request({ path: '/api/v1/marketplace/produce?grade=Grade%20A', method: 'GET' });
    assert(catalog.status === 200 && catalog.data.lots.length > 0, `Buyer browsed verified catalog (${catalog.data.lots.length} lots)`);

    // Checkout created batch
    const orderRes = await request({ path: '/api/v1/orders/checkout', method: 'POST' }, {
      lot_id: createdLotId,
      quantity: 100,
      delivery_address: 'Reliance Fresh Distribution Center, Vashi APMC Sector 19, Navi Mumbai'
    }, buyerToken);
    assert(orderRes.status === 201 && orderRes.data.order.id, 'Buyer placed order successfully');
    assert(orderRes.data.order.verification_status === 'pending_owner', 'Order created in "pending_owner" state');
    assert(orderRes.data.order.escrow_status === 'held', 'Order escrow status is "held"');
    placedOrderId = orderRes.data.order.id;

    // 5. DOUBLE-APPROVAL ESCROW SYSTEM (OWNER VERIFICATION FLOW)
    console.log("\n--- Phase 5: Owner Double-Approval Escrow Verification ---");
    
    // Owner checks pending queue
    const pendingRes = await request({ path: '/api/v1/admin/transactions/pending', method: 'GET' }, null, ownerToken);
    assert(pendingRes.status === 200 && pendingRes.data.transactions.length > 0, `Owner retrieved ${pendingRes.data.transactions.length} pending escrow transactions`);

    const targetTx = pendingRes.data.transactions.find(t => t.id === placedOrderId);
    assert(targetTx && targetTx.farmer.digital_passport_verified, 'Transaction displays verified Farmer Digital Passport & QC Hash');

    // Owner Approves Transaction
    const verifyRes = await request({
      path: `/api/v1/admin/transactions/${placedOrderId}/verify`,
      method: 'POST'
    }, { action: 'approve' }, ownerToken);
    assert(verifyRes.status === 200 && verifyRes.data.order.verification_status === 'approved', 'Owner approved order; escrow locked & reefer pickup scheduled');

    // Buyer checks my-orders
    const myOrdersRes = await request({ path: '/api/v1/orders/my-orders', method: 'GET' }, null, buyerToken);
    assert(myOrdersRes.status === 200, 'Buyer retrieved my-orders');
    const updatedOrder = myOrdersRes.data.orders.find(o => o.id === placedOrderId);
    assert(updatedOrder && updatedOrder.verification_status === 'approved', 'Buyer order confirmed "approved" with Reefer telemetry');

    // 6. USER MODERATION & DISMISSAL (ONE-CLICK BAN)
    console.log("\n--- Phase 6: User Moderation & Dismissal ---");
    
    // Create a temporary test suspicious buyer
    const tempReg = await request({ path: '/api/v1/auth/register', method: 'POST' }, {
      name: 'Suspicious Fake Buyer',
      email: `fakebuyer_${Date.now()}@fraudtest.com`,
      password: 'password123',
      role: 'buyer'
    });
    const fakeUserId = tempReg.data.user.id;
    const fakeToken = tempReg.data.token;

    // Owner Dismisses Fake User
    const dismissRes = await request({
      path: `/api/v1/admin/users/${fakeUserId}/dismiss`,
      method: 'PATCH'
    }, { reason: 'Flagged for fraudulent bidding activity' }, ownerToken);
    assert(dismissRes.status === 200 && dismissRes.data.user.is_banned === 1, 'Owner dismissed/banned fake user profile');

    // Banned user attempts to use existing token -> 403 ACCOUNT_BANNED
    const bannedAccess = await request({ path: '/api/v1/orders/my-orders', method: 'GET' }, null, fakeToken);
    assert(bannedAccess.status === 403 && bannedAccess.data.error === 'ACCOUNT_BANNED', 'Banned user token immediately rejected (HTTP 403 ACCOUNT_BANNED)');

    // 7. KISAN VANI MULTILINGUAL VOICE COPILOT
    console.log("\n--- Phase 7: Kisan Vani Multilingual Daily Mandi Voice Copilot ---");

    // Agmarknet Feed
    const feedRes = await request({ path: '/api/v1/mandi/daily-feed', method: 'GET' });
    assert(feedRes.status === 200 && feedRes.data.rates.length >= 5, 'Daily Agmarknet feed contains TOP-5 crops');

    // Marathi Bulletin
    const mrBulletin = await request({ path: '/api/v1/kisan-vani/bulletin?lang=mr', method: 'GET' });
    assert(mrBulletin.status === 200 && mrBulletin.data.bulletin.includes('लासलगाव कांदा'), 'Marathi bulletin generated with regional script');

    // Hindi Bulletin
    const hiBulletin = await request({ path: '/api/v1/kisan-vani/bulletin?lang=hi', method: 'GET' });
    assert(hiBulletin.status === 200 && hiBulletin.data.bulletin.includes('लासलगांव प्याज'), 'Hindi bulletin generated with regional script');

    // Telugu Bulletin
    const teBulletin = await request({ path: '/api/v1/kisan-vani/bulletin?lang=te', method: 'GET' });
    assert(teBulletin.status === 200 && teBulletin.data.bulletin.includes('కిసాన్ డైరెక్ట్'), 'Telugu bulletin generated with regional script');

    // English Bulletin
    const enBulletin = await request({ path: '/api/v1/kisan-vani/bulletin?lang=en', method: 'GET' });
    assert(enBulletin.status === 200 && enBulletin.data.bulletin.includes('KisanDirect Daily Mandi Update'), 'English bulletin generated');

    // TTS Audio Stream Fallback
    const ttsRes = await request({ path: '/api/v1/kisan-vani/tts-stream?lang=hi', method: 'GET' });
    assert(ttsRes.status === 200 && ttsRes.raw.slice(0, 4) === 'RIFF', 'TTS fallback audio stream returned valid WAV binary header');

    console.log("\n==================================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================================");

    server.close();
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error("Unexpected test execution error:", err);
    server.close();
    process.exit(1);
  }
}

runFullSystemTest();
