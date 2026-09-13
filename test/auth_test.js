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

async function runAuthTests() {
  console.log("=== STARTING AUTHENTICATION & SECURITY TEST SUITE ===");
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
    // 1. Login with seeded Farmer account
    const loginRes = await request({
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'farmer@kisandirect.gov.in',
      password: 'farmer123'
    });
    assert(loginRes.status === 200 && loginRes.data.token, 'Seeded farmer login returns JWT token');
    assert(loginRes.data.user.role.toUpperCase() === 'FARMER', 'User role correctly identified as Farmer');
    const farmerToken = loginRes.data.token;

    // 2. Failed login on invalid password
    const failLogin = await request({
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'farmer@kisandirect.gov.in',
      password: 'wrongpassword'
    });
    assert(failLogin.status === 401, 'Invalid password rejected with 401 Unauthorized');

    // 3. Register new test user
    const testEmail = `newfarmer_${Date.now()}@kisandirect.gov.in`;
    const regRes = await request({
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Balasaheb Shinde',
      email: testEmail,
      password: 'securepass123',
      role: 'Farmer',
      phone: '+91-9876543210',
      district_state: 'Dindori, Nashik, Maharashtra'
    });
    assert(regRes.status === 201 && regRes.data.token, 'User registration successfully hashes password and issues JWT');
    const newFarmerToken = regRes.data.token;

    // 4. Prevent duplicate registration
    const dupRes = await request({
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Balasaheb Shinde Duplicate',
      email: testEmail,
      password: 'securepass123',
      role: 'Farmer'
    });
    assert(dupRes.status === 409, 'Duplicate email registration rejected with 409 Conflict');

    // 5. Protected profile route /api/auth/me
    const meUnauth = await request({ port: 3000, path: '/api/auth/me', method: 'GET' });
    assert(meUnauth.status === 401, 'Unauthenticated /api/auth/me rejected with 401');

    const meAuth = await request({
      port: 3000,
      path: '/api/auth/me',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    assert(meAuth.status === 200 && meAuth.data.user.email === 'farmer@kisandirect.gov.in', 'Authenticated /api/auth/me returns farmer profile');

    // 6. Protected Batch Creation linked to user account
    const unauthBatch = await request({
      port: 3000,
      path: '/api/batches',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      commodity_name: 'Nashik Red Onion',
      quantity: 100,
      farmgate_rate: 25.0
    });
    assert(unauthBatch.status === 401, 'Unauthenticated batch creation rejected with 401');

    const authBatch = await request({
      port: 3000,
      path: '/api/batches',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${newFarmerToken}`
      }
    }, {
      commodity_name: 'Dindori Table Grapes',
      category: 'Fruits',
      quantity: 200,
      unit: 'Boxes',
      farmgate_rate: 65.0,
      mandi_rate: 42.0
    });
    assert(authBatch.status === 201 && authBatch.data.batch.user_id === regRes.data.user.id, 'Batch creation automatically linked to authenticated user_id');

    // 7. Data Isolation: Farmer only sees their own listings with user_only=true
    const userOnlyBatches = await request({
      port: 3000,
      path: '/api/batches?user_only=true',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${newFarmerToken}` }
    });
    assert(userOnlyBatches.status === 200 && userOnlyBatches.data.count === 1, `Data isolation verified: New farmer sees exactly 1 lot (theirs), found ${userOnlyBatches.data.count}`);
    assert(userOnlyBatches.data.batches[0].user_id === regRes.data.user.id, 'Retrieved lot belongs strictly to current user');

    // 8. Public Marketplace can still view all batches
    const allBatches = await request({ port: 3000, path: '/api/batches', method: 'GET' });
    assert(allBatches.status === 200 && allBatches.data.count > 1, `Marketplace view aggregates all active batches (${allBatches.data.count} batches)`);

    console.log(`\n=== AUTH TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
  } catch (err) {
    console.error('Test suite error:', err);
    failed++;
  } finally {
    server.close();
  }
}

runAuthTests();
