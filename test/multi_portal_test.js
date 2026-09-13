const http = require('http');
const { app, server } = require('../backend/server');

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
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("KISANDIRECT AI: MULTI-PORTAL & ROLE-AWARE OTP SYSTEM TEST SUITE");
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
    // 1. FRONTEND ASSETS & SPA ROUTING
    console.log("\n--- Phase 1: Frontend SPA Route Serving ---");
    const rootRes = await request({ path: '/', method: 'GET' });
    assert(rootRes.status === 200 && rootRes.raw.includes('portals.css'), 'GET / serves HTML shell with portals.css');

    const routerRes = await request({ path: '/src/router.js', method: 'GET' });
    assert(routerRes.status === 200 && routerRes.raw.includes('Router'), 'GET /src/router.js serves client router module');

    const farmerRouteRes = await request({ path: '/farmer/dashboard', method: 'GET' });
    assert(farmerRouteRes.status === 200 && farmerRouteRes.raw.includes('id="app"'), 'SPA Fallback: /farmer/dashboard returns HTML shell for client routing');

    // 2. OTP AUTHENTICATION & OWNER SECURITY GATEWAY
    console.log("\n--- Phase 2: Role-Aware OTP Gateway & Owner Password Checks ---");

    // Owner OTP without password -> 400
    const ownerNoPass = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      role: 'owner'
    });
    assert(ownerNoPass.status === 400 && ownerNoPass.data.error === 'PASSWORD_REQUIRED_FOR_OWNER', 'Owner Security: Rejects OTP request without Master Password (HTTP 400)');

    // Owner OTP with wrong password -> 401
    const ownerWrongPass = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      role: 'owner',
      password: 'wrongPassword999'
    });
    assert(ownerWrongPass.status === 401 && ownerWrongPass.data.error === 'INVALID_OWNER_CREDENTIALS', 'Owner Security: Rejects invalid master password (HTTP 401)');

    // Owner OTP with valid password -> 200
    const ownerOtpRes = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      role: 'owner',
      password: 'owner123'
    });
    assert(ownerOtpRes.status === 200 && ownerOtpRes.data.otp_preview, 'Owner Security: Issued 6-digit OTP after password verification');

    // Verify Owner OTP
    const ownerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      otp: ownerOtpRes.data.otp_preview
    });
    assert(ownerVerify.status === 200 && ownerVerify.data.role === 'owner', 'Owner OTP verified: Issued JWT with role "owner"');
    ownerToken = ownerVerify.data.token;

    // Farmer OTP flow
    const farmerOtpRes = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'farmer@kisandirect.gov.in',
      role: 'farmer'
    });
    assert(farmerOtpRes.status === 200 && farmerOtpRes.data.otp_preview, 'Farmer OTP issued successfully');

    const farmerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: 'farmer@kisandirect.gov.in',
      otp: farmerOtpRes.data.otp_preview
    });
    assert(farmerVerify.status === 200 && farmerVerify.data.role === 'farmer', 'Farmer OTP verified: Issued JWT with role "farmer"');
    farmerToken = farmerVerify.data.token;

    // Buyer OTP flow
    const buyerOtpRes = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'procurement@reliancefresh.com',
      role: 'buyer'
    });
    assert(buyerOtpRes.status === 200 && buyerOtpRes.data.otp_preview, 'Buyer OTP issued successfully');

    const buyerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: 'procurement@reliancefresh.com',
      otp: buyerOtpRes.data.otp_preview
    });
    assert(buyerVerify.status === 200 && buyerVerify.data.role === 'buyer', 'Buyer OTP verified: Issued JWT with role "buyer"');
    buyerToken = buyerVerify.data.token;

    // Session validation
    const meRes = await request({ path: '/api/auth/me', method: 'GET' }, null, farmerToken);
    assert(meRes.status === 200 && meRes.data.user.email === 'farmer@kisandirect.gov.in', 'Session validated via /api/auth/me');

    // 3. STRICT BACKEND ROLE GUARDS (RBAC)
    console.log("\n--- Phase 3: Strict Backend Role Guards ---");

    // Farmer cannot access Buyer orders
    const guard1 = await request({ path: '/api/buyer/orders', method: 'POST' }, { quantity: 10 }, farmerToken);
    assert(guard1.status === 403 && guard1.data.error === 'FORBIDDEN_ROLE', 'RBAC Guard: Farmer blocked from Buyer orders (HTTP 403)');

    // Farmer cannot access Owner pending transactions
    const guard2 = await request({ path: '/api/owner/pending-transactions', method: 'GET' }, null, farmerToken);
    assert(guard2.status === 403 && guard2.data.error === 'FORBIDDEN_ROLE', 'RBAC Guard: Farmer blocked from Owner control room (HTTP 403)');

    // Buyer cannot access Farmer crop creation
    const guard3 = await request({ path: '/api/farmer/crops', method: 'POST' }, { crop_name: 'Fake' }, buyerToken);
    assert(guard3.status === 403 && guard3.data.error === 'FORBIDDEN_ROLE', 'RBAC Guard: Buyer blocked from Farmer crop creation (HTTP 403)');

    // Buyer cannot access Owner user moderation
    const guard4 = await request({ path: '/api/owner/users', method: 'GET' }, null, buyerToken);
    assert(guard4.status === 403 && guard4.data.error === 'FORBIDDEN_ROLE', 'RBAC Guard: Buyer blocked from Owner moderation deck (HTTP 403)');

    // 4. FARMER PORTAL FUNCTIONALITY
    console.log("\n--- Phase 4: Farmer Portal Endpoints ---");
    const newCrop = {
      crop_name: 'Pimpalgaon Red Onion',
      variety: 'Garwa Pink',
      quantity_kg: 500,
      farmgate_price: 25.00,
      qc_grade: 'Grade A+',
      location: 'Pimpalgaon Baswant, Nashik, MH'
    };
    const cropRes = await request({ path: '/api/farmer/crops', method: 'POST' }, newCrop, farmerToken);
    assert(cropRes.status === 201 && cropRes.data.lot.id, 'Farmer created harvest batch with Lot ID');
    assert(cropRes.data.lot.qc_hash.startsWith('SHA256:'), 'Batch contains tamper-proof SHA-256 QC Hash');
    createdLotId = cropRes.data.lot.id;

    const myCrops = await request({ path: '/api/farmer/crops', method: 'GET' }, null, farmerToken);
    assert(myCrops.status === 200 && myCrops.data.crops.length > 0, `Farmer retrieved ${myCrops.data.crops.length} own crops`);

    const myPayouts = await request({ path: '/api/farmer/payouts', method: 'GET' }, null, farmerToken);
    assert(myPayouts.status === 200 && myPayouts.data.summary.settlementPolicy.includes('T+1'), 'Farmer retrieved T+1 Escrow payout ledger');

    // 5. BUYER MARKETPLACE & CHECKOUT
    console.log("\n--- Phase 5: Buyer Marketplace & Checkout ---");
    const marketplace = await request({ path: '/api/buyer/marketplace', method: 'GET' });
    assert(marketplace.status === 200 && marketplace.data.lots.length > 0, `Buyer browsed verified catalog (${marketplace.data.lots.length} lots)`);

    const orderRes = await request({ path: '/api/buyer/orders', method: 'POST' }, {
      crop_lot_id: createdLotId,
      quantity: 100,
      delivery_address: 'Reliance Fresh Distribution Center, Vashi APMC Sector 19, Navi Mumbai'
    }, buyerToken);
    assert(orderRes.status === 201 && orderRes.data.order.status === 'pending_owner', 'Buyer placed order in "pending_owner" state');
    assert(orderRes.data.order.escrow_status === 'held', 'Buyer escrow funds are held');
    placedOrderId = orderRes.data.order.id;

    const myOrders = await request({ path: '/api/buyer/orders', method: 'GET' }, null, buyerToken);
    assert(myOrders.status === 200 && myOrders.data.orders.length > 0, 'Buyer retrieved orders with live cold-chain telemetry');
    assert(myOrders.data.orders[0].telemetry.temperature_c !== undefined, 'Order includes Reefer temperature telemetry');

    // 6. OWNER DOUBLE-APPROVAL & MODERATION
    console.log("\n--- Phase 6: Owner Control Room & Double-Approval Engine ---");
    const pendingTx = await request({ path: '/api/owner/pending-transactions', method: 'GET' }, null, ownerToken);
    assert(pendingTx.status === 200 && pendingTx.data.transactions.length > 0, `Owner retrieved ${pendingTx.data.transactions.length} pending escrow transactions`);

    const approveTx = await request({
      path: `/api/owner/transactions/${placedOrderId}/action`,
      method: 'POST'
    }, { action: 'APPROVE' }, ownerToken);
    assert(approveTx.status === 200 && approveTx.data.order.status === 'approved', 'Owner approved transaction; status updated to "approved" and reefer scheduled');

    // User moderation list
    const usersList = await request({ path: '/api/owner/users', method: 'GET' }, null, ownerToken);
    assert(usersList.status === 200 && usersList.data.users.length >= 2, `Owner moderation deck lists ${usersList.data.users.length} active participants`);

    // Create temporary suspicious account & dismiss
    const tempBuyerOtp = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: `fakebuyer_${Date.now()}@fraudtest.com`,
      role: 'buyer'
    });
    const tempBuyerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: tempBuyerOtp.data.email,
      otp: tempBuyerOtp.data.otp_preview
    });
    const fakeUserId = tempBuyerVerify.data.user.id;
    const fakeUserToken = tempBuyerVerify.data.token;

    // Owner dismisses suspicious buyer
    const dismissRes = await request({
      path: `/api/owner/users/${fakeUserId}/dismiss`,
      method: 'PATCH'
    }, { reason: 'Fraudulent bidding activity' }, ownerToken);
    assert(dismissRes.status === 200 && dismissRes.data.user.is_banned === 1, 'Owner dismissed/banned fake user profile');

    // Dismissed user token rejected
    const blockedAccess = await request({ path: '/api/buyer/orders', method: 'GET' }, null, fakeUserToken);
    assert(blockedAccess.status === 403 && blockedAccess.data.error === 'ACCOUNT_BANNED', 'Banned user token blocked immediately (HTTP 403 ACCOUNT_BANNED)');

    // 7. LIVE ACTIVITY FEED
    console.log("\n--- Phase 7: Live System Activity Feed ---");
    const feedRes = await request({ path: '/api/owner/live-feed', method: 'GET' }, null, ownerToken);
    assert(feedRes.status === 200 && feedRes.data.feed.length > 0, `Live activity feed logged ${feedRes.data.feed.length} system events`);

    console.log("\n==================================================================");
    console.log(`MULTI-PORTAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================================");

    server.close();
    process.exit(failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Unexpected test error:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
