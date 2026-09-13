const http = require('http');
const db = require('../server/db');

function request({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runRbacTests() {
  console.log('===============================================================');
  console.log('=== STRICT RBAC & OWNER APPROVAL LIFECYCLE VERIFICATION SUITE ==');
  console.log('===============================================================\n');

  // Idempotency: Reset test accounts to PENDING_APPROVAL
  db.prepare("UPDATE users SET approval_status = 'PENDING_APPROVAL', approved_at = NULL WHERE email IN ('farmer@test.com', 'buyer@test.com')").run();
  // Clean up any previous test registration accounts
  db.prepare("DELETE FROM users WHERE email IN ('test_reg_farmer@test.com', 'test_reg_buyer@test.com')").run();

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = null) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      if (details) console.error('       Details:', details);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // PHASE 1: Seed Account Status Verification
    // -------------------------------------------------------------
    console.log('--- PHASE 1: Seed Account Status Verification ---');
    const ownerUser = db.prepare("SELECT * FROM users WHERE email = 'owner@kisandirect.com'").get();
    assert(ownerUser && ownerUser.role === 'OWNER' && ownerUser.approval_status === 'APPROVED',
      'Owner account is present with role=OWNER and approval_status=APPROVED');

    const testFarmer = db.prepare("SELECT * FROM users WHERE email = 'farmer@test.com'").get();
    assert(testFarmer && testFarmer.role === 'FARMER' && testFarmer.approval_status === 'PENDING_APPROVAL',
      'Test Farmer account is present with role=FARMER and approval_status=PENDING_APPROVAL');

    const testBuyer = db.prepare("SELECT * FROM users WHERE email = 'buyer@test.com'").get();
    assert(testBuyer && testBuyer.role === 'BUYER' && testBuyer.approval_status === 'PENDING_APPROVAL',
      'Test Buyer account is present with role=BUYER and approval_status=PENDING_APPROVAL');

    // -------------------------------------------------------------
    // PHASE 2: Pending Farmer Blocked from Core Transactions
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: Pending Farmer Transaction Gate ---');
    const farmerLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'farmer@test.com', password: 'farmerPass123' }
    });
    assert(farmerLogin.status === 200 && farmerLogin.data.token, 'Test Farmer login successful');
    assert(farmerLogin.data.user.approval_status === 'PENDING_APPROVAL', 'Test Farmer token reflects PENDING_APPROVAL');
    const farmerToken = farmerLogin.data.token;
    const farmerId = farmerLogin.data.user.id;

    // Attempt to create a listing while pending
    const blockedListing = await request({
      path: '/api/farmer/listings',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      body: {
        commodity_name: 'Nashik Red Onion Export Grade',
        category: 'Vegetables',
        variety: 'Export Grade Pink Onion',
        available_qty: 250,
        unit: 'quintal',
        farmgate_price_per_unit: 1850,
        mandi_reference_price: 2400,
        quality_grade: 'Grade A Export'
      }
    });
    assert(blockedListing.status === 403, 'Pending Farmer listing attempt blocked with HTTP 403 Forbidden');
    assert(blockedListing.data.code === 'ACCOUNT_PENDING_OWNER_APPROVAL',
      'Error code correctly returns ACCOUNT_PENDING_OWNER_APPROVAL');

    // -------------------------------------------------------------
    // PHASE 3: Pending Buyer Blocked from Core Transactions
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: Pending Buyer Transaction Gate ---');
    const buyerLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'buyer@test.com', password: 'buyerPass123' }
    });
    assert(buyerLogin.status === 200 && buyerLogin.data.token, 'Test Buyer login successful');
    assert(buyerLogin.data.user.approval_status === 'PENDING_APPROVAL', 'Test Buyer token reflects PENDING_APPROVAL');
    const buyerToken = buyerLogin.data.token;
    const buyerId = buyerLogin.data.user.id;

    // Attempt direct farmer contact while pending
    const blockedContact = await request({
      path: `/api/buyer/contact/${farmerId}`,
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert(blockedContact.status === 403, 'Pending Buyer direct farmer contact blocked with HTTP 403 Forbidden');
    assert(blockedContact.data.code === 'ACCOUNT_PENDING_OWNER_APPROVAL',
      'Contact error code correctly returns ACCOUNT_PENDING_OWNER_APPROVAL');

    // Attempt checkout while pending
    const blockedCheckout = await request({
      path: '/api/buyer/checkout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` },
      body: {
        items: [{ listing_id: 'CROP-TEST-001', quantity: 10, price_per_unit: 2000 }],
        payment_method: 'ESCROW_WALLET',
        delivery_address: 'APMC Market Yard, Navi Mumbai'
      }
    });
    assert(blockedCheckout.status === 403, 'Pending Buyer checkout attempt blocked with HTTP 403 Forbidden');
    assert(blockedCheckout.data.code === 'ACCOUNT_PENDING_OWNER_APPROVAL',
      'Checkout error code correctly returns ACCOUNT_PENDING_OWNER_APPROVAL');

    // Browse marketplace while pending - phone numbers should be masked
    const browseRes = await request({
      path: '/api/buyer/browse',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert(browseRes.status === 200 && browseRes.data.listings.length > 0,
      `Marketplace listings accessible to pending buyer (${browseRes.data.listings.length} items)`);
    const sampleListing = browseRes.data.listings[0];
    assert(sampleListing.farmer_phone && sampleListing.farmer_phone.includes('**'),
      `Farmer phone number is masked for unapproved buyer (Sample: ${sampleListing.farmer_phone})`);

    // -------------------------------------------------------------
    // PHASE 4: Strict Cross-Role Access Control (Zero Leakage)
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: Strict Cross-Role Isolation ---');
    // Farmer trying to access Owner Control Room endpoints
    const farmerAttemptOwner = await request({
      path: '/api/owner/pending-users',
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    assert(farmerAttemptOwner.status === 403, 'Farmer denied access to /api/owner/pending-users (403)');

    // Buyer trying to access Farmer listing creation
    const buyerAttemptFarmer = await request({
      path: '/api/farmer/listings',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` },
      body: { commodity_name: 'Illegal produce injection' }
    });
    assert(buyerAttemptFarmer.status === 403, 'Buyer denied access to /api/farmer/listings (403)');

    // Farmer trying to access Buyer checkout
    const farmerAttemptBuyer = await request({
      path: '/api/buyer/checkout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      body: { items: [] }
    });
    assert(farmerAttemptBuyer.status === 403, 'Farmer denied access to /api/buyer/checkout (403)');

    // -------------------------------------------------------------
    // PHASE 5: Platform Owner Governance Desk
    // -------------------------------------------------------------
    console.log('\n--- PHASE 5: Platform Owner Governance Desk ---');
    const ownerLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'owner@kisandirect.com', password: 'ownerPass123' }
    });
    assert(ownerLogin.status === 200 && ownerLogin.data.token, 'Platform Owner login successful');
    assert(ownerLogin.data.user.role === 'OWNER', 'Owner role authenticated as OWNER');
    const ownerToken = ownerLogin.data.token;

    // Get owner dashboard metrics
    const metricsRes = await request({
      path: '/api/owner/dashboard-metrics',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(metricsRes.status === 200 && metricsRes.data.metrics, 'Owner metrics retrieved');
    assert(metricsRes.data.metrics.pendingFarmers >= 1, `Pending farmers count >= 1 (Got ${metricsRes.data.metrics.pendingFarmers})`);
    assert(metricsRes.data.metrics.pendingBuyers >= 1, `Pending buyers count >= 1 (Got ${metricsRes.data.metrics.pendingBuyers})`);

    // Fetch pending users lists
    const pendingUsers = await request({
      path: '/api/owner/pending-users',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(pendingUsers.status === 200, 'Pending users retrieved from Owner Governance Desk');
    const pendingFarmerFound = pendingUsers.data.pendingFarmers.find(f => f.email === 'farmer@test.com');
    const pendingBuyerFound = pendingUsers.data.pendingBuyers.find(b => b.email === 'buyer@test.com');
    assert(Boolean(pendingFarmerFound), 'Test Farmer is present in pendingFarmers desk list');
    assert(Boolean(pendingBuyerFound), 'Test Buyer is present in pendingBuyers desk list');

    // -------------------------------------------------------------
    // PHASE 6: Owner Approves Farmer & Transactions Unlock
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6: Farmer Approval & Listing Lifecycle ---');
    const approveFarmerRes = await request({
      path: `/api/owner/approve-user/${farmerId}`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(approveFarmerRes.status === 200 && approveFarmerRes.data.success, 'Owner successfully approved Test Farmer');

    // Re-login farmer to acquire token with APPROVED status
    const approvedFarmerLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'farmer@test.com', password: 'farmerPass123' }
    });
    assert(approvedFarmerLogin.data.user.approval_status === 'APPROVED', 'Farmer re-login confirms approval_status = APPROVED');
    const approvedFarmerToken = approvedFarmerLogin.data.token;

    // Farmer now creates harvest listing -> MUST SUCCEED (201)
    const activeListing = await request({
      path: '/api/farmer/listings',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${approvedFarmerToken}` },
      body: {
        commodity_name: 'Nashik Export Red Onion Batch A1',
        category: 'Vegetables',
        variety: 'Export Garwa Onion',
        available_qty: 300,
        unit: 'quintal',
        farmgate_price_per_unit: 1950,
        mandi_reference_price: 2500,
        quality_grade: 'Grade A Export Certified'
      }
    });
    assert(activeListing.status === 201 && activeListing.data.success,
      'Approved Farmer successfully listed produce on marketplace!');
    const createdListingId = activeListing.data.listing.id;

    // Verify listing appears in farmer's dashboard
    const myListingsRes = await request({
      path: '/api/farmer/my-listings',
      headers: { 'Authorization': `Bearer ${approvedFarmerToken}` }
    });
    assert(myListingsRes.status === 200 && myListingsRes.data.listings.some(l => l.id === createdListingId),
      'New batch verified in Farmer Hub /my-listings inventory');

    // -------------------------------------------------------------
    // PHASE 7: Owner Approves Buyer & Checkout Unlocks
    // -------------------------------------------------------------
    console.log('\n--- PHASE 7: Buyer Approval & Checkout Lifecycle ---');
    const approveBuyerRes = await request({
      path: `/api/owner/approve-user/${buyerId}`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ownerToken}` }
    });
    assert(approveBuyerRes.status === 200 && approveBuyerRes.data.success, 'Owner successfully approved Test Buyer');

    // Re-login buyer to acquire token with APPROVED status
    const approvedBuyerLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'buyer@test.com', password: 'buyerPass123' }
    });
    assert(approvedBuyerLogin.data.user.approval_status === 'APPROVED', 'Buyer re-login confirms approval_status = APPROVED');
    const approvedBuyerToken = approvedBuyerLogin.data.token;

    // Contact farmer -> MUST SUCCEED (200) with unmasked contact
    const approvedContactRes = await request({
      path: `/api/buyer/contact/${farmerId}`,
      headers: { 'Authorization': `Bearer ${approvedBuyerToken}` }
    });
    assert(approvedContactRes.status === 200 && approvedContactRes.data.farmer,
      'Approved Buyer successfully accessed direct farmer contact dossier');
    assert(approvedContactRes.data.farmer.phone && !approvedContactRes.data.farmer.phone.includes('*'),
      `Full unmasked phone number revealed to approved buyer (${approvedContactRes.data.farmer.phone})`);

    // Approved Buyer executes checkout -> MUST SUCCEED (200)
    const checkoutRes = await request({
      path: '/api/buyer/checkout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${approvedBuyerToken}` },
      body: {
        items: [{ listing_id: createdListingId, quantity: 20, price_per_unit: 1950 }],
        payment_method: 'ESCROW_SECURE_HOLD',
        delivery_address: 'B2B Wholesale Terminal 4, APMC Vashi, Navi Mumbai'
      }
    });
    assert((checkoutRes.status === 201 || checkoutRes.status === 200) && checkoutRes.data.success,
      'Approved Buyer successfully completed procurement checkout with Escrow hold!');
    assert(checkoutRes.data.order && checkoutRes.data.order.id,
      `Order generated with ID: ${checkoutRes.data?.order?.id}`);

    // -------------------------------------------------------------
    // PHASE 8: Dynamic Registration Starting in PENDING_APPROVAL
    // -------------------------------------------------------------
    console.log('\n--- PHASE 8: Dynamic Registration Mandatory Approval Gate ---');
    // Register new Farmer
    const newFarmerReg = await request({
      path: '/api/auth/register',
      method: 'POST',
      body: {
        name: 'Suresh Patil',
        email: 'test_reg_farmer@test.com',
        phone: '9822334455',
        password: 'securePass123',
        role: 'FARMER',
        state_district: 'Solapur, Maharashtra',
        land_area_acres: 8.5,
        crop_speciality: 'Pomegranate & Grapes',
        kisan_id: 'KISAN-MH-77889'
      }
    });
    assert(newFarmerReg.status === 201 && newFarmerReg.data.user, 'New Farmer registered successfully');
    assert(newFarmerReg.data.user.approval_status === 'PENDING_APPROVAL',
      'New registered Farmer starts strictly in PENDING_APPROVAL status');
    assert(newFarmerReg.data.user.farmer_details && newFarmerReg.data.user.farmer_details.land_area_acres === 8.5,
      'Farmer land_area_acres captured in profile');

    // Register new Buyer
    const newBuyerReg = await request({
      path: '/api/auth/register',
      method: 'POST',
      body: {
        name: 'Apex Supermarkets Procurement',
        email: 'test_reg_buyer@test.com',
        phone: '9877665544',
        password: 'securePass123',
        role: 'BUYER',
        state_district: 'Bengaluru, Karnataka',
        business_name: 'Apex Supermarkets Pvt Ltd',
        gstin_number: '29ABCDE1234F1Z5',
        trade_type: 'Supermarket / Modern Retail',
        fssai_license: '10019022000999'
      }
    });
    assert(newBuyerReg.status === 201 && newBuyerReg.data.user, 'New Buyer registered successfully');
    assert(newBuyerReg.data.user.approval_status === 'PENDING_APPROVAL',
      'New registered Buyer starts strictly in PENDING_APPROVAL status');
    assert(newBuyerReg.data.user.buyer_details && newBuyerReg.data.user.buyer_details.gstin === '29ABCDE1234F1Z5',
      'Buyer GSTIN captured in profile');

    // Clean up registered test accounts
    db.prepare("DELETE FROM users WHERE email IN ('test_reg_farmer@test.com', 'test_reg_buyer@test.com')").run();

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`=== RBAC TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRbacTests();
