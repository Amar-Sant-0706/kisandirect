// ==============================================================================
// Verification Test: Crop Listing with Real Crop Pictures & "My Listed Crops" List
// ==============================================================================
const http = require('http');
const assert = require('assert');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    }, (res) => {
      let respData = '';
      res.on('data', chunk => respData += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: respData }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== VERIFYING CROP PICTURE LISTING & MY LISTED CROPS VIEW ===\n');

  // 1. Verify store.html contains all crop picture elements
  const storeRes = await get('/store.html');
  assert.strictEqual(storeRes.status, 200, 'store.html should return 200');
  const html = storeRes.body;

  const checks = [
    { name: 'Crop picture preview image (#sellCropPreviewImg)', test: html.includes('id="sellCropPreviewImg"') },
    { name: 'Crop picture source tag indicator (#sellCropImgSourceTag)', test: html.includes('id="sellCropImgSourceTag"') },
    { name: 'Crop photo file upload input (#sellCropFileInput)', test: html.includes('id="sellCropFileInput"') },
    { name: 'Crop preset chips container (#sellCropPresetChips)', test: html.includes('id="sellCropPresetChips"') },
    { name: 'Wheat preset trigger', test: html.includes("selectCropPreset('Sharbati Wheat'") },
    { name: 'Red Onion preset trigger', test: html.includes("selectCropPreset('Nashik Red Onion'") },
    { name: 'Tomato preset trigger', test: html.includes("selectCropPreset('Hybrid Tomato'") },
    { name: 'My Listed Crops modal container (#myListedCropsModal)', test: html.includes('id="myListedCropsModal"') },
    { name: 'My Listed Crops list container (#myListedCropsListContainer)', test: html.includes('id="myListedCropsListContainer"') },
    { name: 'My Listed Crops lots count badge (#myListedLotsCountBadge)', test: html.includes('id="myListedLotsCountBadge"') },
    { name: 'Navbar My Listings button (#navMyListedCropsBtn)', test: html.includes('id="navMyListedCropsBtn"') },
    { name: 'User Menu My Listed Crops item', test: html.includes('🌾 My Listed Crops') },
    { name: 'CROP_IMAGE_MAP dictionary defined', test: html.includes('var CROP_IMAGE_MAP = {') },
    { name: 'resolveCropImage function defined', test: html.includes('function resolveCropImage(') },
    { name: 'renderMyListedCrops function defined', test: html.includes('function renderMyListedCrops(') },
    { name: 'handleSellCropFileUpload function defined', test: html.includes('function handleSellCropFileUpload(') },
    { name: 'Dynamically attaches cropImage to newCard (not hardcoded wheat)', test: html.includes('<img src="${cropImage}"') }
  ];

  let passedChecks = 0;
  for (const c of checks) {
    if (c.test) {
      console.log(`  [PASS] ${c.name}`);
      passedChecks++;
    } else {
      console.error(`  [FAIL] ${c.name}`);
    }
  }

  assert.strictEqual(passedChecks, checks.length, 'All store.html UI checks must pass');

  // 2. Test farmer login and backend batch creation with image
  console.log('\n--- Testing Backend API Batch Creation with Crop Picture ---');
  const loginRes = await post('/api/auth/login', {
    email: 'farmer@kisandirect.gov.in',
    password: 'farmer123'
  });
  assert.strictEqual(loginRes.status, 200, 'Farmer login should return 200');
  const loginData = JSON.parse(loginRes.body);
  assert.ok(loginData.token, 'Token should be returned');

  const testBatch = {
    crop_name: 'Hybrid Cherry Tomatoes',
    variety: 'Export Red Cherry',
    quantity: 60,
    unit: 'Crates',
    price_per_unit: 1800,
    farm_location: 'Narayangaon, Pune, Maharashtra',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80'
  };

  const batchRes = await post('/api/farmer/batches', testBatch, {
    'Authorization': `Bearer ${loginData.token}`
  });
  assert.strictEqual(batchRes.status, 201, 'Batch listing should return 201 Created');
  const batchData = JSON.parse(batchRes.body);
  assert.strictEqual(batchData.success, true, 'Batch creation must be successful');
  assert.strictEqual(batchData.lot.image, testBatch.image, 'Saved batch lot must preserve the exact crop image');
  console.log(`  [PASS] Successfully posted lot #${batchData.lot.id} with preserved crop image: ${batchData.lot.image}`);

  // 3. Test retrieving farmer batches
  const getBatchesRes = await new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/farmer/batches', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
  assert.strictEqual(getBatchesRes.status, 200, 'GET /api/farmer/batches should return 200');
  const batchesData = JSON.parse(getBatchesRes.body);
  assert.ok(batchesData.crops.length > 0, 'Should have crop lots listed');
  const found = batchesData.crops.find(c => c.id === batchData.lot.id);
  assert.ok(found, 'Newly listed lot must be returned in crops list');
  assert.strictEqual(found.image, testBatch.image, 'Image in returned list must match the uploaded/selected crop image');
  console.log(`  [PASS] Retrieved lot #${found.id} from /api/farmer/batches with verified crop photo!`);

  console.log('\n=== ALL CROP PICTURE & LISTING VERIFICATIONS PASSED (100%) ===\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
