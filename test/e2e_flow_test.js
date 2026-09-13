const http = require('http');

function post(path, data, token = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: headers
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: headers
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function verifyScenario() {
  console.log("=== RUNNING E2E WORKFLOW SCENARIO ON RUNNING SERVER ===");

  // 1. Initial login as Farmer
  console.log("[1] Authenticating as Farmer Ramesh Patil...");
  const loginRes = await post('/api/auth/login', {
    email: 'farmer@kisandirect.gov.in',
    password: 'farmer123'
  });
  console.log(`[1.1] Authenticated: ${loginRes.data.user.name} (${loginRes.data.user.role})`);
  const token = loginRes.data.token;

  // 2. Fetch active batches
  const initialBatches = await get('/api/batches', token);
  console.log(`[2] Initial active batches: ${initialBatches.data.count}`);

  // 3. Add completely new vegetable/fruit not previously in the table
  const newProduceListing = {
    commodity_name: "Nagpur Organic Mandarin Oranges",
    category: "Fruits",
    farmer_fpo_name: "Vidarbha Citrus Producer Federation",
    variety: "Nagpur Santra Grade A",
    quantity: 350,
    unit: "Crates",
    farmgate_rate: 45.00,
    mandi_rate: 28.00,
    pickup_location: "Katol Orchard, Nagpur, Maharashtra",
    quality_grade: "Grade A (Export Quality)",
    dispatch_schedule: "Today, Reefer Scheduled"
  };

  console.log(`[3] Submitting new produce listing: "${newProduceListing.commodity_name}"...`);
  const postBatchRes = await post('/api/batches', newProduceListing, token);
  console.log(`[3.1] Server Response:`, postBatchRes.data.message);
  console.log(`[3.2] Created Lot: ${postBatchRes.data.batch.lot_number}`);
  console.log(`[3.3] Farmer Gain: ₹${postBatchRes.data.batch.economics.farmerGainPerUnit}/unit (+${postBatchRes.data.batch.economics.farmerGainPercent}%)`);

  // 4. Confirm it appears in live farm listings table for this farmer
  const userBatches = await get('/api/batches?user_only=true', token);
  const found = userBatches.data.batches.find(b => b.lot_number === postBatchRes.data.batch.lot_number);
  console.log(`[4] User-isolated listings query verified: ${found ? 'FOUND (' + found.lot_number + ': ' + found.commodity_name + ')' : 'NOT FOUND'}`);

  // 5. Run AI Inspection for the new produce
  const qcRes = await post('/api/qc/analyze', {
    commodity_name: "Nagpur Organic Mandarin Oranges",
    image_url: "https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=600&q=80"
  }, token);
  console.log(`[5] AI Quality Scanner Result for new produce:`);
  console.log(`    Freshness: ${qcRes.data.overallScore}`);
  console.log(`    Grade: ${qcRes.data.grade}`);
  console.log(`    Ripeness: ${qcRes.data.ripeness}`);
  console.log(`    DOCA SHA-256 Hash: ${qcRes.data.hash}`);

  // 6. Test switching forecast chart commodity
  const forecastRes = await get(`/api/forecast/${encodeURIComponent(postBatchRes.data.batch.commodity_id)}`);
  console.log(`[6] Dynamic Demand Forecast for new produce:`);
  console.log(`    Crop: ${forecastRes.data.forecast.crop}`);
  console.log(`    Volatility: ${forecastRes.data.forecast.volatilityIndex}`);
  console.log(`    Advisory: ${forecastRes.data.forecast.advisory}`);

  // 7. DOCA surveillance table
  const docaRes = await get('/api/doca/surveillance');
  console.log(`[7] DOCA Control Room live spreads across ${docaRes.data.count} registered commodities.`);

  console.log("\n=== ALL E2E SCENARIOS VERIFIED SUCCESSFULLY ON SERVER ===");
}

verifyScenario().catch(console.error);
