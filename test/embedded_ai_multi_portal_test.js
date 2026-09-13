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
  console.log("KISANDIRECT AI: EMBEDDED AI MODULES & MULTI-PORTAL TEST SUITE");
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
  let createdBatchId, placedOrderId;

  try {
    // 1. AUTHENTICATION & OWNER SECURITY SAFEGUARD
    console.log("\n--- Phase 1: Authentication & Owner Password Safeguard ---");
    
    // Owner OTP requires master password
    const ownerNoPass = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      role: 'owner'
    });
    assert(ownerNoPass.status === 400 && ownerNoPass.data.error === 'PASSWORD_REQUIRED_FOR_OWNER', 'Owner Security: Denied without pre-seeded master password (HTTP 400)');

    const ownerOtp = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      role: 'owner',
      password: 'owner123'
    });
    assert(ownerOtp.status === 200 && ownerOtp.data.otp_preview, 'Owner OTP issued with valid master password');

    const ownerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: 'owner@kisandirect.com',
      otp: ownerOtp.data.otp_preview
    });
    assert(ownerVerify.status === 200 && ownerVerify.data.role === 'owner', 'Owner JWT issued with role "owner"');
    ownerToken = ownerVerify.data.token;

    // Farmer OTP
    const farmerOtp = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'farmer@kisandirect.gov.in',
      role: 'farmer'
    });
    const farmerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: 'farmer@kisandirect.gov.in',
      otp: farmerOtp.data.otp_preview
    });
    farmerToken = farmerVerify.data.token;
    assert(farmerToken, 'Farmer authenticated and JWT issued');

    // Buyer OTP
    const buyerOtp = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: 'procurement@reliancefresh.com',
      role: 'buyer'
    });
    const buyerVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: 'procurement@reliancefresh.com',
      otp: buyerOtp.data.otp_preview
    });
    buyerToken = buyerVerify.data.token;
    assert(buyerToken, 'Buyer authenticated and JWT issued');

    // 2. FARMER EMBEDDED AI: KISAN-VISION & MARKET ADVISORY
    console.log("\n--- Phase 2: Farmer Embedded AI (Kisan-Vision & Market Advisory) ---");
    
    // AI Quality Scanner
    const scanRes = await request({ path: '/api/farmer/ai-quality-scan', method: 'POST' }, {
      cropType: 'Tomato'
    }, farmerToken);
    assert(scanRes.status === 200 && scanRes.data.success, 'POST /api/farmer/ai-quality-scan executed successfully');
    assert(scanRes.data.scan.freshnessScore >= 90, `Kisan-Vision computed Freshness Index: ${scanRes.data.scan.freshnessScore}%`);
    assert(scanRes.data.scan.ripenessScore >= 85, `Kisan-Vision computed Ripeness Score: ${scanRes.data.scan.ripenessScore}%`);
    assert(scanRes.data.scan.blemishRate !== undefined, `Kisan-Vision computed Blemish Rate: ${scanRes.data.scan.blemishRate}%`);
    assert(scanRes.data.scan.diameterMm !== undefined, `Kisan-Vision computed Calibrated Diameter: ${scanRes.data.scan.diameterMm} mm`);
    assert(scanRes.data.scan.qcHash.startsWith('SHA256:'), 'Kisan-Vision attached cryptographic SHA-256 QC Hash');
    assert(scanRes.data.scan.fairPriceDelta, `Fair Price Delta computed: ${scanRes.data.scan.fairPriceDelta}`);

    // AI Demand & Price Advisory
    const advRes = await request({ path: '/api/farmer/market-advisory', method: 'GET' }, null, farmerToken);
    assert(advRes.status === 200 && advRes.data.advisory.holdingRecommendations.headline.includes('Hold 40%'), 'GET /api/farmer/market-advisory returned Holding Recommendations');
    assert(advRes.data.advisory.festivalSurge.demandIndex.includes('+28.4%'), 'Advisory returned Festival Demand Spike radar');
    assert(advRes.data.advisory.priceBands.length > 0, `Advisory returned ${advRes.data.advisory.priceBands.length} commodity price bands`);

    // Create batch with Kisan-Vision QC data via /api/farmer/batches
    const batchRes = await request({ path: '/api/farmer/batches', method: 'POST' }, {
      crop_name: 'Solapur Vine-Ripe Tomatoes',
      variety: 'Abhinav Seminis',
      quantity_kg: 600,
      farmgate_price: scanRes.data.scan.recommendedPrice,
      qc_grade: scanRes.data.scan.grade,
      qc_hash: scanRes.data.scan.qcHash,
      freshness_score: scanRes.data.scan.freshnessScore,
      ripeness_score: scanRes.data.scan.ripenessScore,
      blemish_rate: scanRes.data.scan.blemishRate,
      diameter_mm: scanRes.data.scan.diameterMm,
      location: 'Solapur Farmgate Hub, MH'
    }, farmerToken);
    assert(batchRes.status === 201 && batchRes.data.lot.id, 'POST /api/farmer/batches listed new crop with QC data');
    assert(batchRes.data.lot.qc_hash === scanRes.data.scan.qcHash, 'Batch preserved tamper-proof Kisan-Vision SHA-256 QC Hash');
    createdBatchId = batchRes.data.lot.id;

    // List farmer batches via /api/farmer/batches
    const myBatches = await request({ path: '/api/farmer/batches', method: 'GET' }, null, farmerToken);
    assert(myBatches.status === 200 && myBatches.data.crops.length > 0, `GET /api/farmer/batches retrieved ${myBatches.data.crops.length} batches`);

    // 3. BUYER MARKETPLACE & LOGISTICS TELEMETRY
    console.log("\n--- Phase 3: Buyer Marketplace, Checkout & Logistics Telemetry ---");
    
    // Browse verified lots via /api/marketplace/lots
    const lotsRes = await request({ path: '/api/marketplace/lots', method: 'GET' });
    assert(lotsRes.status === 200 && lotsRes.data.lots.length > 0, `GET /api/marketplace/lots returned ${lotsRes.data.lots.length} verified produce lots`);

    // Place order via /api/orders/checkout
    const checkoutRes = await request({ path: '/api/orders/checkout', method: 'POST' }, {
      crop_lot_id: createdBatchId,
      quantity: 120,
      delivery_address: 'Reliance Fresh Distribution Center, Sector 19 Vashi APMC, Navi Mumbai'
    }, buyerToken);
    assert(checkoutRes.status === 201 && checkoutRes.data.order.status === 'pending_owner', 'POST /api/orders/checkout placed order in "pending_owner" state');
    placedOrderId = checkoutRes.data.order.id;

    // Buyer get orders
    const buyerOrdersRes = await request({ path: '/api/buyer/orders', method: 'GET' }, null, buyerToken);
    assert(buyerOrdersRes.status === 200 && buyerOrdersRes.data.orders.length > 0, 'GET /api/buyer/orders returned buyer orders with telemetry');

    // Telemetry endpoint: /api/logistics/telemetry/:orderId
    const telemetryRes = await request({ path: `/api/logistics/telemetry/${placedOrderId}`, method: 'GET' });
    assert(telemetryRes.status === 200 && telemetryRes.data.telemetry, 'GET /api/logistics/telemetry/:orderId returned active cold-chain telemetry');
    assert(telemetryRes.data.telemetry.temperature.currentC === 4.2, `Reefer cargo temp verified at ${telemetryRes.data.telemetry.temperature.currentC}°C continuous`);
    assert(telemetryRes.data.telemetry.currentGps.lat === 19.2183, 'GPS coordinates verified on Western Agri-Express Corridor');
    assert(telemetryRes.data.telemetry.milestones.length >= 4, 'Order timeline includes delivery milestones');

    // 4. OWNER CONTROL ROOM: DOUBLE-APPROVAL, VRP OPTIMIZER & MARKET SURVEILLANCE
    console.log("\n--- Phase 4: Owner Double-Approval, VRP Fleet Optimizer & Market Surveillance ---");

    // Pending orders via /api/owner/pending-orders
    const pendingOrdersRes = await request({ path: '/api/owner/pending-orders', method: 'GET' }, null, ownerToken);
    assert(pendingOrdersRes.status === 200 && pendingOrdersRes.data.transactions.length > 0, `GET /api/owner/pending-orders listed ${pendingOrdersRes.data.transactions.length} orders waiting review`);

    // Verify order via /api/owner/orders/:id/verify
    const verifyApproveRes = await request({
      path: `/api/owner/orders/${placedOrderId}/verify`,
      method: 'POST'
    }, { action: 'APPROVE' }, ownerToken);
    assert(verifyApproveRes.status === 200 && verifyApproveRes.data.order.status === 'approved', 'POST /api/owner/orders/:id/verify approved transaction & scheduled Reefer');

    // AI Route Fleet Optimizer (VRP)
    const fleetRes = await request({ path: '/api/owner/fleet-optimizer', method: 'GET' }, null, ownerToken);
    assert(fleetRes.status === 200 && fleetRes.data.fleet.corridorName.includes('Western Agri-Express'), 'GET /api/owner/fleet-optimizer returned Western Agri-Express corridor');
    assert(fleetRes.data.fleet.distanceSavedKm === 42.4, `VRP optimization saved ${fleetRes.data.fleet.distanceSavedKm} km (${fleetRes.data.fleet.distanceSavedPercent})`);
    assert(fleetRes.data.fleet.waypoints.length >= 4, `VRP corridor tracks ${fleetRes.data.fleet.waypoints.length} scheduled waypoint checkpoints`);
    assert(fleetRes.data.fleet.sensorLogs.length > 0, 'VRP returned real-time Reefer temperature & compressor telemetry logs');

    // AI Market Surveillance & Price Volatility Engine
    const surveillanceRes = await request({ path: '/api/owner/market-surveillance', method: 'GET' }, null, ownerToken);
    assert(surveillanceRes.status === 200 && surveillanceRes.data.surveillance.priceSpreads.length >= 4, 'GET /api/owner/market-surveillance returned Mandi vs KisanDirect spreads');
    assert(surveillanceRes.data.surveillance.earlyGlutAlert.glutProbability === '74%', 'Market Surveillance detected 74% Early Harvest Glut warning on Nashik Onion');
    assert(surveillanceRes.data.surveillance.volatilityIndex === 34.2, `Price Volatility Index tracked at ${surveillanceRes.data.surveillance.volatilityIndex}`);

    // 5. USER MODERATION & PROFILE DISMISSAL
    console.log("\n--- Phase 5: Participant Moderation & Immediate Session Ban ---");
    
    // Create test suspicious buyer
    const tempOtp = await request({ path: '/api/auth/send-otp', method: 'POST' }, {
      email: `suspicious_${Date.now()}@badactor.com`,
      role: 'buyer'
    });
    const tempVerify = await request({ path: '/api/auth/verify-otp', method: 'POST' }, {
      email: tempOtp.data.email,
      otp: tempOtp.data.otp_preview
    });
    const tempUserId = tempVerify.data.user.id;
    const tempUserToken = tempVerify.data.token;

    // Owner dismisses suspicious participant
    const banRes = await request({
      path: `/api/owner/users/${tempUserId}/dismiss`,
      method: 'PATCH'
    }, { reason: 'Illegal speculative trading cartel' }, ownerToken);
    assert(banRes.status === 200 && banRes.data.user.is_banned === 1, 'PATCH /api/owner/users/:id/dismiss banned participant profile');

    // Verify dismissed user token is rejected immediately
    const blockedRes = await request({ path: '/api/buyer/orders', method: 'GET' }, null, tempUserToken);
    assert(blockedRes.status === 403 && blockedRes.data.error === 'ACCOUNT_BANNED', 'Banned user token blocked immediately with HTTP 403 ACCOUNT_BANNED');

    // 6. KISAN VANI VOICE COPILOT (TTS & STT INTEGRATION)
    console.log("\n--- Phase 6: Kisan Vani Multilingual Voice Copilot ---");

    // Marathi briefing
    const voiceMr = await request({ path: '/api/voice/briefing?lang=mr-IN', method: 'GET' });
    assert(voiceMr.status === 200 && voiceMr.data.briefing.lang === 'mr-IN', 'GET /api/voice/briefing?lang=mr-IN returned Marathi voice bulletin');
    assert(voiceMr.data.briefing.script.includes('लासलगाव'), 'Marathi script includes Lasalgaon farmgate rates');

    // Hindi briefing
    const voiceHi = await request({ path: '/api/voice/briefing?lang=hi-IN', method: 'GET' });
    assert(voiceHi.status === 200 && voiceHi.data.briefing.lang === 'hi-IN', 'GET /api/voice/briefing?lang=hi-IN returned Hindi voice bulletin');

    // English briefing
    const voiceEn = await request({ path: '/api/voice/briefing?lang=en-IN', method: 'GET' });
    assert(voiceEn.status === 200 && voiceEn.data.briefing.lang === 'en-IN', 'GET /api/voice/briefing?lang=en-IN returned English voice bulletin');

    // Voice query: Onion price
    const queryOnion = await request({ path: '/api/voice/query', method: 'POST' }, {
      query: 'कांदा भाव काय आहे?',
      lang: 'mr-IN'
    });
    assert(queryOnion.status === 200 && queryOnion.data.cropMatch === 'Onion', 'POST /api/voice/query resolved Onion intent');
    assert(queryOnion.data.reply.includes('चोवीस रुपये पन्नास पैसे'), 'Voice reply speaks accurate KisanDirect direct rates');

    // Voice query: Pickup timing
    const queryPickup = await request({ path: '/api/voice/query', method: 'POST' }, {
      query: 'पिकअप वेळ कधी आहे?',
      lang: 'mr-IN'
    });
    assert(queryPickup.status === 200 && queryPickup.data.reply.includes('सकाळी साडे आठ'), 'Voice reply speaks scheduled Reefer pickup slot');

    console.log("\n==================================================================");
    console.log(`EMBEDDED AI MULTI-PORTAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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
