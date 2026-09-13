const http = require('http');

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

const db = require('../server/db');

async function runEnterpriseTests() {
  console.log('=== RUNNING ENTERPRISE PORTAL & KYC LIFECYCLE TEST ===\n');
  
  // Ensure idempotent start
  db.prepare("UPDATE users SET kyc_status = 'PENDING' WHERE email = 'buyer@kisandirect.com'").run();

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
    // Reset test buyer to PENDING so test is 100% idempotent across multiple runs
    db.prepare("UPDATE users SET kyc_status = 'PENDING', approval_status = 'PENDING_APPROVAL' WHERE email = 'buyer@kisandirect.com'").run();

    // 1. Farmer Login
    const fLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'farmer@kisandirect.com', password: 'farmer123' }
    });
    assert(fLogin.status === 200 && fLogin.data.token, 'Farmer login successful');
    const farmerToken = fLogin.data.token;
    const farmerId = fLogin.data.user.id;

    // 2. Farmer creates new produce listing
    const newCrop = await request({
      path: '/api/farmer/listings',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      body: {
        commodity_name: 'Ratnagiri Alphonso Mango',
        category: 'Fruit',
        variety: 'Hapus Organic GI',
        available_qty: 350,
        unit: 'crate',
        farmgate_price_per_unit: 920.0,
        mandi_reference_price: 1450.0,
        quality_grade: 'Grade A+ Export'
      }
    });
    assert(newCrop.status === 201 && newCrop.data.success, 'Farmer successfully listed "Ratnagiri Alphonso Mango"');

    // 3. Farmer gets my-listings
    const myListings = await request({
      path: '/api/farmer/my-listings',
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    assert(myListings.status === 200 && myListings.data.count >= 1, `Farmer listings retrieved (${myListings.data.count} items)`);

    // 4. Unverified Buyer Login
    const bLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'buyer@kisandirect.com', password: 'buyer123' }
    });
    assert(bLogin.status === 200 && bLogin.data.user.kyc_status === 'PENDING', 'Unverified buyer login verified (kyc_status: PENDING)');
    const buyerToken = bLogin.data.token;
    const buyerId = bLogin.data.user.id;

    // 5. Unverified Buyer tries to view direct farmer contact -> EXPECT 403 FORBIDDEN
    const contactBlocked = await request({
      path: `/api/buyer/contact/${farmerId}`,
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert(contactBlocked.status === 403, 'KYC Gate enforced: Unverified buyer contact request blocked with 403 Forbidden');

    // 6. Admin Login
    const aLogin = await request({
      path: '/api/auth/login',
      method: 'POST',
      body: { email: 'admin@kisandirect.com', password: 'admin123' }
    });
    assert(aLogin.status === 200 && (aLogin.data.user.role === 'ADMIN' || aLogin.data.user.role === 'OWNER'), 'Admin login successful');
    const adminToken = aLogin.data.token;

    // 7. Admin views pending buyers
    const pendingList = await request({
      path: '/api/admin/buyers/pending',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(pendingList.status === 200 && pendingList.data.count >= 1, `Admin pending KYC list retrieved (${pendingList.data.count} buyers)`);

    // 8. Admin approves Buyer KYC
    const verifyBuyer = await request({
      path: `/api/admin/buyers/${buyerId}/verify`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { action: 'APPROVED' }
    });
    assert(verifyBuyer.status === 200 && verifyBuyer.data.buyer.kyc_status === 'APPROVED', 'Admin approved buyer GSTIN credentials');

    // 9. Buyer now accesses farmer contact -> EXPECT 200 OK
    // Refresh buyer profile
    const buyerRefreshed = await request({
      path: '/api/auth/me',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert(buyerRefreshed.status === 200 && buyerRefreshed.data.user.kyc_status === 'APPROVED', 'Buyer profile reflects APPROVED KYC status');

    const contactAllowed = await request({
      path: `/api/buyer/contact/${farmerId}`,
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert(contactAllowed.status === 200 && contactAllowed.data.contact.farmerName, 'Approved buyer successfully unlocked farmer direct contact');

    // 10. Buyer adds produce to cart & checks out
    const addCart = await request({
      path: '/api/buyer/cart',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` },
      body: {
        listing_id: newCrop.data.listing.id,
        quantity: 10,
        action: 'set'
      }
    });
    assert(addCart.status === 200 && addCart.data.success, 'Produce added to Buyer Cart');

    const cart = await request({
      path: '/api/buyer/cart',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    assert(cart.status === 200 && cart.data.items.length >= 1, `Cart items retrieved (Total: ₹${cart.data.summary.totalPayable})`);

    const checkout = await request({
      path: '/api/buyer/checkout',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` },
      body: { delivery_address: 'Reliance Fresh Hub, Sector 19, Vashi, Navi Mumbai' }
    });
    assert(checkout.status === 201 && checkout.data.orders.length >= 1, `Checkout completed with ${checkout.data.orders[0].order_number} (ESCROW_HELD)`);
    const placedOrder = checkout.data.orders[0];

    // 11. Farmer views inbound orders & advances status
    const farmerOrders = await request({
      path: '/api/farmer/orders',
      headers: { 'Authorization': `Bearer ${farmerToken}` }
    });
    assert(farmerOrders.status === 200 && farmerOrders.data.count >= 1, `Farmer received inbound purchase order #${placedOrder.order_number}`);

    const packOrder = await request({
      path: `/api/farmer/orders/${placedOrder.id}/status`,
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      body: { status: 'FARMER_PACKING' }
    });
    assert(packOrder.status === 200 && packOrder.data.order.order_status === 'FARMER_PACKING', 'Farmer updated order stage to FARMER_PACKING');

    const reeferOrder = await request({
      path: `/api/farmer/orders/${placedOrder.id}/status`,
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${farmerToken}` },
      body: { status: 'REEFER_PICKED_UP' }
    });
    assert(reeferOrder.status === 200 && reeferOrder.data.order.order_status === 'REEFER_PICKED_UP', 'Farmer updated order stage to REEFER_PICKED_UP');

    // 12. Admin advances order to DELIVERED
    const deliverOrder = await request({
      path: `/api/admin/orders/${placedOrder.id}/status`,
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { order_status: 'DELIVERED', payment_status: 'SETTLED_TO_FARMER' }
    });
    assert(deliverOrder.status === 200 && deliverOrder.data.order.order_status === 'DELIVERED', 'Admin delivered order & settled escrow to farmer');

    // 13. Buyer verifies order history with 5-stage timeline
    const buyerOrders = await request({
      path: '/api/buyer/orders',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const tracked = buyerOrders.data.orders.find(o => o.id === placedOrder.id);
    assert(tracked && tracked.order_status === 'DELIVERED', 'Buyer order tracking timeline confirms DELIVERED status');

    console.log(`\n=== ENTERPRISE LIFECYCLE SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  } catch (err) {
    console.error('Test error:', err);
  }
}

runEnterpriseTests();
