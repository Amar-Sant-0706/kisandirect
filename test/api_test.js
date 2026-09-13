const http = require('http');
const { app, server } = require('../server/server');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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

async function runTests() {
  console.log("=== STARTING AUTOMATED API TEST SUITE ===");
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
    // 1. Health check
    const health = await request({ port: 3000, path: '/api/health', method: 'GET' });
    assert(health.status === 200 && health.data.status === 'online', 'Health endpoint reports online');

    // 2. GET /api/commodities
    const comms = await request({ port: 3000, path: '/api/commodities', method: 'GET' });
    assert(comms.status === 200 && comms.data.count >= 15, `GET /api/commodities returned ${comms.data.count} commodities (>= 15 required)`);
    assert(comms.data.grouped && comms.data.grouped['Fruits'].length > 0, 'Commodities grouped by category');

    // 3. POST /api/commodities (Add custom produce)
    const newCrop = {
      name: `Shimla Royal Capsicum Hybrid ${Date.now()}`,
      category: 'Vegetables',
      standard_unit: 'kg',
      base_mandi_benchmark_rate: 35.0,
      shelf_life_days: 14,
      target_reefer_temp_celsius: 6.0,
      description: 'Crisp green polyhouse capsicum'
    };
    const addComm = await request({
      port: 3000,
      path: '/api/commodities',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, newCrop);
    assert((addComm.status === 201 || addComm.status === 200) && addComm.data.success, 'POST /api/commodities dynamically registers new crop');

    // 4. GET /api/batches
    const batches = await request({ port: 3000, path: '/api/batches', method: 'GET' });
    assert(batches.status === 200 && batches.data.count > 0, `GET /api/batches returned ${batches.data.count} batches`);
    assert(batches.data.batches[0].economics.farmerGainPercent !== undefined, 'Batch includes dynamic farmer gain margin calculation');

    // 5. POST /api/batches (List batch for ANY crop, auto-generating lot)
    const login = await request({
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'farmer@kisandirect.gov.in', password: 'farmer123' });

    const newBatch = {
      commodity_name: 'Nagpur Sweet Oranges',
      category: 'Fruits',
      farmer_fpo_name: 'Vidarbha Citrus Producer Federation',
      variety: 'Nagpur Santra Prime',
      quantity: 500,
      unit: 'Crates',
      farmgate_rate: 45.00,
      mandi_rate: 28.00,
      pickup_location: 'Katol Orchard, Nagpur, Maharashtra',
      dispatch_schedule: 'Tomorrow, Reefer MH-31'
    };
    const addBatch = await request({
      port: 3000,
      path: '/api/batches',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${login.data.token}`
      }
    }, newBatch);
    assert(addBatch.status === 201 && addBatch.data.batch.lot_number.startsWith('LOT-'), `POST /api/batches created lot ${addBatch.data.batch.lot_number}`);
    assert(addBatch.data.batch.economics.farmerGainPercent > 0, 'Dynamic margin computed for new batch');

    // 6. POST /api/qc/analyze (Algorithmic grading + SHA-256 hash)
    const qcReq = {
      commodity_name: 'Nagpur Sweet Oranges',
      image_url: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=600&q=80'
    };
    const qcRes = await request({
      port: 3000,
      path: '/api/qc/analyze',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, qcReq);
    assert(qcRes.status === 200 && qcRes.data.hash.startsWith('SHA256:'), `POST /api/qc/analyze generated verifiable hash: ${qcRes.data.hash}`);
    assert(qcRes.data.freshness_score > 90, `Freshness score computed: ${qcRes.data.freshness_score}%`);

    // 7. GET /api/forecast/:commodityId
    const fcst = await request({ port: 3000, path: '/api/forecast/COMM-VEG-01', method: 'GET' });
    assert(fcst.status === 200 && fcst.data.forecast.predictedPriceMax.length === 7, 'GET /api/forecast returns 15-day prediction curve');
    assert(fcst.data.forecast.advisory.length > 20, 'Forecast includes seasonal supply glut advisory');

    // 8. POST /api/procurement/b2b
    const b2bReq = {
      commodity_name: 'Nagpur Sweet Oranges',
      quantity: 100,
      buyer_name: 'BigBasket Wholesale Hub',
      destination_city: 'Mumbai',
      fleet_type: 'Reefer Cold-Chain Express (2°C - 6°C)'
    };
    const b2bRes = await request({
      port: 3000,
      path: '/api/procurement/b2b',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, b2bReq);
    assert(b2bRes.status === 201 && b2bRes.data.order.orderId.startsWith('RFQ-B2B-'), 'POST /api/procurement/b2b created RFQ inquiry');

    // 9. POST /api/orders/checkout
    const checkoutReq = {
      buyer_name: 'Ramesh Sharma',
      items: [
        { id: 'COMM-VEG-01', name: 'Nashik Red Onion', price: 29.0, farmerShare: 24.5, qty: 10 }
      ]
    };
    const checkoutRes = await request({
      port: 3000,
      path: '/api/orders/checkout',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, checkoutReq);
    assert(checkoutRes.status === 201 && checkoutRes.data.summary.totalAmount === 290, 'POST /api/orders/checkout processed consumer order');

    // 10. GET /api/doca/surveillance
    const doca = await request({ port: 3000, path: '/api/doca/surveillance', method: 'GET' });
    assert(doca.status === 200 && doca.data.surveillance.length >= 15, `DOCA surveillance returns ${doca.data.surveillance.length} produce spreads`);

    console.log(`\n=== API TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (e) {
    console.error('Test error:', e);
    failed++;
  } finally {
    server.close();
  }
}

runTests();
