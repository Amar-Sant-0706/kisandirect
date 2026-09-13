const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

function seedDatabase() {
  console.log("Seeding KisanDirect AI Database with Users and Data Isolation...");

  // Drop tables and re-initialize schema to ensure fresh constraints
  db.exec(`
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS cart_items;
    DROP TABLE IF EXISTS produce_listings;
    DROP TABLE IF EXISTS orders_and_inquiries;
    DROP TABLE IF EXISTS market_trends_forecasts;
    DROP TABLE IF EXISTS qc_inspections;
    DROP TABLE IF EXISTS crop_batches;
    DROP TABLE IF EXISTS commodities;
    DROP TABLE IF EXISTS produce_categories;
    DROP TABLE IF EXISTS users;
  `);

  if (db.initSchema) db.initSchema();

  // 1. Seed Users (Farmer, Buyer, Admin, etc.)
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, name, email, password_hash, role, approval_status, phone, state_district, district_state,
      farmer_details, buyer_details, business_name, gstin_number, fssai_license, kyc_status, created_at, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoUsers = [
    // Required Seed Accounts
    {
      id: 'USR-OWNER-PRIMARY',
      name: 'Platform Owner',
      email: 'owner@kisandirect.com',
      password: 'ownerPass123',
      role: 'OWNER',
      approval_status: 'APPROVED',
      phone: '+91-9800000000',
      district_state: 'New Delhi (Platform HQ)',
      business_name: 'KisanDirect National Grid Authority',
      gstin_number: '07AAACK0001A1Z0',
      fssai_license: '10019011000001',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    {
      id: 'USR-FARMER-TEST',
      name: 'Test Farmer Patil',
      email: 'farmer@test.com',
      password: 'farmerPass123',
      role: 'FARMER',
      approval_status: 'PENDING_APPROVAL',
      phone: '+91-9822019999',
      district_state: 'Nashik, Maharashtra',
      farmer_details: JSON.stringify({
        land_area_acres: 14.5,
        crop_speciality: 'Nagpur Oranges & Red Onions',
        kisan_id: 'MH-KISAN-90211'
      }),
      business_name: 'Patil Organic Farms',
      gstin_number: '',
      fssai_license: '',
      kyc_status: 'PENDING'
    },
    {
      id: 'USR-BUYER-TEST',
      name: 'Test Buyer Wholesaler',
      email: 'buyer@test.com',
      password: 'buyerPass123',
      role: 'BUYER',
      approval_status: 'PENDING_APPROVAL',
      phone: '+91-9811199999',
      district_state: 'Mumbai, Maharashtra',
      buyer_details: JSON.stringify({
        business_name: 'Apex Retail Mart Ltd',
        gstin: '27AABCA1234F1ZP',
        trade_type: 'Wholesale Supermarket'
      }),
      business_name: 'Apex Retail Mart Ltd',
      gstin_number: '27AABCA1234F1ZP',
      fssai_license: '11519022000456',
      kyc_status: 'PENDING'
    },
    // Enterprise Portal Accounts
    {
      id: 'USR-ADMIN-ROOT',
      name: 'System Owner / Admin',
      email: 'admin@kisandirect.com',
      password: 'admin123',
      role: 'OWNER',
      approval_status: 'APPROVED',
      phone: '+91-9800000001',
      district_state: 'New Delhi (DOCA Headquarters)',
      business_name: 'KisanDirect National Grid Authority',
      gstin_number: '07AAACK0001A1Z0',
      fssai_license: '10019011000001',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    {
      id: 'USR-FARMER-ENTERPRISE',
      name: 'Ramesh Patil (Farmer Producer)',
      email: 'farmer@kisandirect.com',
      password: 'farmer123',
      role: 'FARMER',
      approval_status: 'APPROVED',
      phone: '+91-9822012345',
      district_state: 'Nashik, Maharashtra',
      farmer_details: JSON.stringify({
        land_area_acres: 25.0,
        crop_speciality: 'Alphonso Mango & Pomegranate',
        kisan_id: 'MH-KISAN-10024'
      }),
      business_name: 'Patil Agro Fresh Farms',
      gstin_number: '27AABCP1234F1Z5',
      fssai_license: '11520033000123',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    {
      id: 'USR-BUYER-PENDING',
      name: 'Anil Agarwal (Retail Wholesaler)',
      email: 'buyer@kisandirect.com',
      password: 'buyer123',
      role: 'BUYER',
      approval_status: 'PENDING_APPROVAL',
      phone: '+91-9811122233',
      district_state: 'Mumbai, Maharashtra',
      buyer_details: JSON.stringify({
        business_name: 'FreshMart Retailers Pvt Ltd',
        gstin: '27AABCU9603R1ZM',
        trade_type: 'B2B Supermarket Chain'
      }),
      business_name: 'FreshMart Retailers Pvt Ltd',
      gstin_number: '27AABCU9603R1ZM',
      fssai_license: '11519022000456',
      kyc_status: 'PENDING'
    },
    {
      id: 'USR-BUYER-VERIFIED',
      name: 'Vikram Mehta (Procurement Head)',
      email: 'verified_buyer@kisandirect.com',
      password: 'buyer123',
      role: 'BUYER',
      approval_status: 'APPROVED',
      phone: '+91-9820011223',
      district_state: 'Mumbai, Maharashtra',
      buyer_details: JSON.stringify({
        business_name: 'Reliance Fresh Logistics Hub',
        gstin: '27AAACR7188G1ZV',
        trade_type: 'National Retail Hypermarket'
      }),
      business_name: 'Reliance Fresh Logistics Hub',
      gstin_number: '27AAACR7188G1ZV',
      fssai_license: '10018022007890',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    // Backwards-compatible accounts
    {
      id: 'USR-FARMER-01',
      name: 'Ramesh Patil',
      email: 'farmer@kisandirect.gov.in',
      password: 'farmer123',
      role: 'FARMER',
      approval_status: 'APPROVED',
      phone: '+91-9822012345',
      district_state: 'Nashik, Maharashtra',
      business_name: 'Nashik Krishi FPC',
      gstin_number: '27AABCP1234F1Z5',
      fssai_license: '11520033000123',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    {
      id: 'USR-FPO-01',
      name: 'Sahyadri Farmers Co-op Admin',
      email: 'fpo@sahyadri.coop',
      password: 'fpo123',
      role: 'FARMER',
      approval_status: 'APPROVED',
      phone: '+91-9822054321',
      district_state: 'Lasalgaon, Maharashtra',
      business_name: 'Sahyadri Farmers Producer Company',
      gstin_number: '27AAACS1122P1Z8',
      fssai_license: '11518011000789',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    {
      id: 'USR-BUYER-01',
      name: 'Vikram Mehta (Reliance Fresh)',
      email: 'procurement@reliancefresh.com',
      password: 'buyer123',
      role: 'BUYER',
      approval_status: 'APPROVED',
      phone: '+91-9820011223',
      district_state: 'Mumbai, Maharashtra',
      business_name: 'Reliance Retail Supply Chain',
      gstin_number: '27AAACR7188G1ZV',
      fssai_license: '10018022007890',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    },
    {
      id: 'USR-CONSUMER-01',
      name: 'Priya Sharma',
      email: 'consumer@gmail.com',
      password: 'consumer123',
      role: 'BUYER',
      approval_status: 'APPROVED',
      phone: '+91-9123456789',
      district_state: 'Pune, Maharashtra',
      business_name: '',
      gstin_number: '',
      fssai_license: '',
      kyc_status: 'APPROVED',
      approved_at: new Date().toISOString()
    }
  ];

  for (const u of demoUsers) {
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(
      u.id,
      u.name,
      u.email,
      hash,
      u.role,
      u.approval_status || 'APPROVED',
      u.phone,
      u.district_state,
      u.district_state,
      u.farmer_details || null,
      u.buyer_details || null,
      u.business_name || '',
      u.gstin_number || '',
      u.fssai_license || '',
      u.kyc_status || 'APPROVED',
      new Date().toISOString(),
      u.approved_at || null
    );
  }

  // 2. Categories
  const insertCategory = db.prepare(`INSERT INTO produce_categories (name) VALUES (?)`);
  const categories = ['Vegetables', 'Fruits', 'Grains', 'Pulses', 'Spices', 'Exotics'];
  const catMap = {};
  for (const cat of categories) {
    const result = insertCategory.run(cat);
    catMap[cat] = result.lastInsertRowid;
  }

  // 3. Commodities (18 diverse commodities)
  const insertCommodity = db.prepare(`
    INSERT INTO commodities (
      id, category_id, name, standard_unit, base_mandi_benchmark_rate, 
      shelf_life_days, target_reefer_temp_celsius, image, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const commoditiesData = [
    // Vegetables
    {
      id: 'COMM-VEG-01',
      category: 'Vegetables',
      name: 'Nashik Red Onion (Garwa)',
      unit: 'kg',
      base_mandi: 16.00,
      shelf_life: 120,
      temp: 10.0,
      image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80',
      description: 'Sun-cured medium to large bulbs with 4-month shelf life. High pungency, zero chemical sprout suppressants.'
    },
    {
      id: 'COMM-VEG-02',
      category: 'Vegetables',
      name: 'Kolar Vine-Ripe Tomatoes (Hybrid)',
      unit: 'kg',
      base_mandi: 12.50,
      shelf_life: 10,
      temp: 12.0,
      image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
      description: 'Thick-walled, high lycopene tomatoes optimal for culinary and institutional table use. 10-day transport life.'
    },
    {
      id: 'COMM-VEG-03',
      category: 'Vegetables',
      name: 'Agra Chipsona White Potatoes',
      unit: 'kg',
      base_mandi: 11.00,
      shelf_life: 90,
      temp: 8.0,
      image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
      description: 'Low-sugar, high dry-matter tuber preferred for culinary baking, frying, and institutional mess kitchens.'
    },
    {
      id: 'COMM-VEG-04',
      category: 'Vegetables',
      name: 'Shimla Green Capsicum',
      unit: 'kg',
      base_mandi: 28.00,
      shelf_life: 14,
      temp: 7.0,
      image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=600&q=80',
      description: 'Crisp, glossy bell peppers harvested from high-altitude polyhouses in Himachal.'
    },
    {
      id: 'COMM-VEG-05',
      category: 'Vegetables',
      name: 'Dindigul Farm Cauliflower',
      unit: 'kg',
      base_mandi: 18.00,
      shelf_life: 8,
      temp: 4.0,
      image: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?auto=format&fit=crop&w=600&q=80',
      description: 'Snow-white compact curds protected by lush green jacket leaves.'
    },
    {
      id: 'COMM-VEG-06',
      category: 'Vegetables',
      name: 'Guntur Hot Green Chili',
      unit: 'kg',
      base_mandi: 32.00,
      shelf_life: 15,
      temp: 8.0,
      image: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?auto=format&fit=crop&w=600&q=80',
      description: 'High capsaicin fresh green chilies with intense aroma and dark green luster.'
    },

    // Fruits
    {
      id: 'COMM-FRT-01',
      category: 'Fruits',
      name: 'Ratnagiri Alphonso Mango',
      unit: 'crate',
      base_mandi: 650.00,
      shelf_life: 12,
      temp: 13.0,
      image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
      description: 'GI-tagged authentic Hapus mangoes. Naturally tree-ripened without calcium carbide.'
    },
    {
      id: 'COMM-FRT-02',
      category: 'Fruits',
      name: 'Jalgaon Robusta Banana',
      unit: 'kg',
      base_mandi: 14.00,
      shelf_life: 9,
      temp: 14.0,
      image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
      description: 'High potassium Grand Naine / Robusta bananas grown along the Tapi river basin.'
    },
    {
      id: 'COMM-FRT-03',
      category: 'Fruits',
      name: 'Solapur Bhagwa Pomegranate',
      unit: 'kg',
      base_mandi: 75.00,
      shelf_life: 30,
      temp: 5.0,
      image: 'https://images.unsplash.com/photo-1541344999736-83eca872f241?auto=format&fit=crop&w=600&q=80',
      description: 'Deep red soft arils, high antioxidant levels with sweet-tart ruby juice.'
    },
    {
      id: 'COMM-FRT-04',
      category: 'Fruits',
      name: 'Kinnaur Royal Crisp Apples',
      unit: 'kg',
      base_mandi: 70.00,
      shelf_life: 60,
      temp: 2.0,
      image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
      description: 'High-altitude mountain apples harvested at 9,000 ft. Crisp texture, deep natural blush without wax polishing.'
    },
    {
      id: 'COMM-FRT-05',
      category: 'Fruits',
      name: 'Nagpur Mandarin Oranges',
      unit: 'kg',
      base_mandi: 26.00,
      shelf_life: 20,
      temp: 6.0,
      image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=600&q=80',
      description: 'Easy-peel citrus bursting with Vitamin C, sweet tangy segment profiles.'
    },

    // Grains
    {
      id: 'COMM-GRN-01',
      category: 'Grains',
      name: 'Dehradun Traditional Basmati Rice',
      unit: 'kg',
      base_mandi: 62.00,
      shelf_life: 365,
      temp: 20.0,
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      description: 'Aged 18 months, 8.2mm grain length with distinct floral aroma irrigated by glacier snowmelt.'
    },
    {
      id: 'COMM-GRN-02',
      category: 'Grains',
      name: 'Sehore Sharbati Golden Wheat',
      unit: 'kg',
      base_mandi: 28.00,
      shelf_life: 365,
      temp: 22.0,
      image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
      description: 'Black soil rainfed golden grains with high gluten strength and natural sweetness.'
    },
    {
      id: 'COMM-GRN-03',
      category: 'Grains',
      name: 'Bikaner Yellow Pearl Bajra',
      unit: 'kg',
      base_mandi: 22.00,
      shelf_life: 180,
      temp: 22.0,
      image: 'https://images.unsplash.com/photo-1543257580-7269da773bf5?auto=format&fit=crop&w=600&q=80',
      description: 'Organic climate-smart pearl millet rich in iron and dietary fiber.'
    },

    // Pulses
    {
      id: 'COMM-PLS-01',
      category: 'Pulses',
      name: 'Latur Organic Desi Chana (Bengal Gram)',
      unit: 'kg',
      base_mandi: 54.00,
      shelf_life: 240,
      temp: 18.0,
      image: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?auto=format&fit=crop&w=600&q=80',
      description: 'High protein, machine-cleaned, unpolished brown chickpea. Directly bagged from farmgate.'
    },
    {
      id: 'COMM-PLS-02',
      category: 'Pulses',
      name: 'Gulbarga Red Toor Dal (Pigeon Pea)',
      unit: 'kg',
      base_mandi: 88.00,
      shelf_life: 240,
      temp: 18.0,
      image: 'https://images.unsplash.com/photo-1585994192701-f1a505c817ea?auto=format&fit=crop&w=600&q=80',
      description: 'GI-tagged Karnataka pigeon pea with rich aroma and quick cooking time.'
    },

    // Spices & Exotics
    {
      id: 'COMM-SPC-01',
      category: 'Spices',
      name: 'Malabar Tellicherry Black Pepper',
      unit: 'kg',
      base_mandi: 480.00,
      shelf_life: 500,
      temp: 22.0,
      image: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?auto=format&fit=crop&w=600&q=80',
      description: 'Bold TGSEB whole black peppercorns harvested in Wayanad hills.'
    },
    {
      id: 'COMM-EXO-01',
      category: 'Exotics',
      name: 'Ooty Hydroponic Iceberg Lettuce',
      unit: 'kg',
      base_mandi: 60.00,
      shelf_life: 7,
      temp: 3.0,
      image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?auto=format&fit=crop&w=600&q=80',
      description: 'Ultra-crisp pesticide-free lettuce grown in climate-controlled Nilgiri polyhouses.'
    }
  ];

  for (const c of commoditiesData) {
    insertCommodity.run(
      c.id,
      catMap[c.category],
      c.name,
      c.unit,
      c.base_mandi,
      c.shelf_life,
      c.temp,
      c.image,
      c.description
    );
  }

  // 4. Crop Batches (Linked to user accounts)
  const insertBatch = db.prepare(`
    INSERT INTO crop_batches (
      id, lot_number, user_id, farmer_fpo_name, commodity_id, variety, quantity, unit,
      farmgate_rate, mandi_rate, quality_grade, harvest_date, pickup_location,
      dispatch_schedule, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const initialBatches = [
    {
      id: 'BATCH-001',
      lot: 'LOT-901',
      user_id: 'USR-FARMER-01',
      fpo: 'Sahyadri Farmers Producer Co.',
      commodity_id: 'COMM-VEG-01',
      variety: 'Garwa Premium Pink',
      quantity: 450,
      unit: 'Quintals',
      farmgate_rate: 24.50,
      mandi_rate: 16.00,
      grade: 'Grade A (QC 98%)',
      harvest_date: '2026-09-04',
      location: 'Lasalgaon Farmgate, Nashik, Maharashtra',
      schedule: 'Today, 08:10 AM (Reefer MH-15)',
      status: 'Loading'
    },
    {
      id: 'BATCH-002',
      lot: 'LOT-884',
      user_id: 'USR-FARMER-01',
      fpo: 'Sahyadri Farmers Producer Co.',
      commodity_id: 'COMM-VEG-02',
      variety: 'Abhinav Seminis',
      quantity: 320,
      unit: 'Crates',
      farmgate_rate: 22.00,
      mandi_rate: 12.50,
      grade: 'Grade A+ (GlobalGAP)',
      harvest_date: '2026-09-06',
      location: 'Srinivaspur Orchard, Kolar, Karnataka',
      schedule: 'Tomorrow, 06:00 AM',
      status: 'Listed'
    },
    {
      id: 'BATCH-003',
      lot: 'LOT-871',
      user_id: 'USR-FPO-01',
      fpo: 'Brajbhoomi Agro Producer Co-op',
      commodity_id: 'COMM-VEG-03',
      variety: 'Chipsona-3',
      quantity: 800,
      unit: 'Quintals',
      farmgate_rate: 18.00,
      mandi_rate: 11.00,
      grade: 'Grade A Industrial',
      harvest_date: '2026-08-28',
      location: 'Fatehabad Hub, Agra, Uttar Pradesh',
      schedule: 'Completed (Delivered)',
      status: 'Paid'
    },
    {
      id: 'BATCH-004',
      lot: 'LOT-860',
      user_id: 'USR-FPO-01',
      fpo: 'Himachal Highlands Fruit Growers',
      commodity_id: 'COMM-FRT-04',
      variety: 'Royal Delicious',
      quantity: 500,
      unit: 'Boxes',
      farmgate_rate: 110.00,
      mandi_rate: 70.00,
      grade: 'Premium Export',
      harvest_date: '2026-09-02',
      location: 'Kalpa, Kinnaur, Himachal Pradesh',
      schedule: 'In-Transit to Delhi NCR Hub',
      status: 'In-Transit'
    },
    {
      id: 'BATCH-005',
      lot: 'LOT-855',
      user_id: 'USR-FPO-01',
      fpo: 'Doon Valley Heritage Farmers Society',
      commodity_id: 'COMM-GRN-01',
      variety: 'Type 3 Himalayan',
      quantity: 250,
      unit: 'Quintals',
      farmgate_rate: 88.00,
      mandi_rate: 62.00,
      grade: 'Export Grade',
      harvest_date: '2026-08-15',
      location: 'Vikasnagar, Dehradun, Uttarakhand',
      schedule: 'Spot Ready',
      status: 'Listed'
    },
    {
      id: 'BATCH-006',
      lot: 'LOT-849',
      user_id: 'USR-FARMER-01',
      fpo: 'Sahyadri Farmers Producer Co.',
      commodity_id: 'COMM-PLS-01',
      variety: 'Vijay Bold',
      quantity: 180,
      unit: 'Quintals',
      farmgate_rate: 72.00,
      mandi_rate: 54.00,
      grade: 'Grade A (Jaivik Bharat)',
      harvest_date: '2026-08-20',
      location: 'Ausa, Latur, Maharashtra',
      schedule: 'Loading Today',
      status: 'Loading'
    },
    {
      id: 'BATCH-007',
      lot: 'LOT-840',
      user_id: 'USR-FARMER-01',
      fpo: 'Sahyadri Farmers Producer Co.',
      commodity_id: 'COMM-FRT-05',
      variety: 'Nagpur Santra',
      quantity: 350,
      unit: 'Crates',
      farmgate_rate: 42.00,
      mandi_rate: 26.00,
      grade: 'Grade A Table',
      harvest_date: '2026-09-05',
      location: 'Katol, Nagpur, Maharashtra',
      schedule: 'Scheduled Tomorrow',
      status: 'Listed'
    },
    {
      id: 'BATCH-008',
      lot: 'LOT-832',
      user_id: 'USR-FPO-01',
      fpo: 'Solapur Pomegranate Producer Fed.',
      commodity_id: 'COMM-FRT-03',
      variety: 'Bhagwa Red',
      quantity: 220,
      unit: 'Boxes',
      farmgate_rate: 115.00,
      mandi_rate: 75.00,
      grade: 'Grade A+ Export',
      harvest_date: '2026-09-03',
      location: 'Sangola, Solapur, Maharashtra',
      schedule: 'Reefer Dispatch Scheduled',
      status: 'Listed'
    }
  ];

  for (const b of initialBatches) {
    insertBatch.run(
      b.id,
      b.lot,
      b.user_id,
      b.fpo,
      b.commodity_id,
      b.variety,
      b.quantity,
      b.unit,
      b.farmgate_rate,
      b.mandi_rate,
      b.grade,
      b.harvest_date,
      b.location,
      b.schedule,
      b.status
    );
  }

  // 5. Initial QC Inspections
  const insertQC = db.prepare(`
    INSERT INTO qc_inspections (
      id, commodity_id, image_url, freshness_score, ripeness_percentage,
      defect_rate, firmness_score, grade, doca_qc_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const qcRecords = [
    {
      id: 'QC-1001',
      commodity_id: 'COMM-VEG-02',
      image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=700&q=80',
      freshness: 96.4,
      ripeness: 94.0,
      defect: 1.2,
      firmness: 4.8,
      grade: 'Grade A+',
      hash: 'SHA256:' + crypto.createHash('sha256').update('COMM-VEG-02-LOT-884-2026-09-06').digest('hex').substring(0, 32),
      created_at: new Date().toISOString()
    },
    {
      id: 'QC-1002',
      commodity_id: 'COMM-VEG-01',
      image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=700&q=80',
      freshness: 95.1,
      ripeness: 100.0,
      defect: 0.8,
      firmness: 5.2,
      grade: 'Grade A Export',
      hash: 'SHA256:' + crypto.createHash('sha256').update('COMM-VEG-01-LOT-901-2026-09-04').digest('hex').substring(0, 32),
      created_at: new Date().toISOString()
    }
  ];

  for (const q of qcRecords) {
    insertQC.run(
      q.id,
      q.commodity_id,
      q.image,
      q.freshness,
      q.ripeness,
      q.defect,
      q.firmness,
      q.grade,
      q.hash,
      q.created_at
    );
  }

  // 6. Market Trends & Forecasts
  const insertForecast = db.prepare(`
    INSERT INTO market_trends_forecasts (
      id, commodity_id, region_state, historical_prices, predicted_prices_15d,
      volatility_index, harvest_advisory
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const forecasts = [
    {
      id: 'FCST-01',
      commodity_id: 'COMM-VEG-01',
      region: 'Maharashtra & Pan-India',
      hist: JSON.stringify({
        dates: ["Aug 24", "Aug 26", "Aug 28", "Aug 30", "Sep 01", "Sep 03", "Sep 05", "Sep 07"],
        prices: [15.2, 15.8, 16.0, 16.5, 17.1, 16.8, 17.5, 17.8]
      }),
      pred: JSON.stringify({
        dates: ["Sep 09", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21"],
        min: [25.0, 26.5, 27.8, 29.0, 31.0, 32.5, 30.0],
        max: [28.5, 30.0, 31.5, 33.5, 35.5, 37.0, 34.0],
        demandTons: [1120, 1280, 1450, 1680, 1920, 2100, 1850]
      }),
      volatility: 'Moderate (Festival Surge Imminent)',
      advisory: 'Navratri festival surge anticipated within 10 days. FPOs are advised to stage release 35% of inventory in week 2 to capture peak retail demand without triggering DOCA buffer interventions.'
    },
    {
      id: 'FCST-02',
      commodity_id: 'COMM-VEG-02',
      region: 'Karnataka & Southern Region',
      hist: JSON.stringify({
        dates: ["Aug 24", "Aug 26", "Aug 28", "Aug 30", "Sep 01", "Sep 03", "Sep 05", "Sep 07"],
        prices: [18.0, 16.5, 14.2, 13.0, 12.8, 13.5, 13.0, 12.5]
      }),
      pred: JSON.stringify({
        dates: ["Sep 09", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21"],
        min: [22.0, 23.0, 24.5, 26.0, 27.5, 29.0, 27.0],
        max: [25.0, 26.5, 28.0, 29.5, 31.0, 32.0, 30.0],
        demandTons: [850, 910, 940, 970, 990, 1020, 960]
      }),
      volatility: 'High Risk of Glut in Mandis, Direct Pre-Orders Optimal',
      advisory: 'Local mandi arrivals in South India projected to surge +28%. To prevent distress sales below ₹14/kg, route 60% of Kolar harvest via consolidated refrigerated freight to Mumbai & Hyderabad bulk buyers.'
    },
    {
      id: 'FCST-03',
      commodity_id: 'COMM-VEG-03',
      region: 'Uttar Pradesh & Northern Plains',
      hist: JSON.stringify({
        dates: ["Aug 24", "Aug 26", "Aug 28", "Aug 30", "Sep 01", "Sep 03", "Sep 05", "Sep 07"],
        prices: [11.5, 11.8, 12.0, 12.2, 12.0, 12.5, 12.8, 12.7]
      }),
      pred: JSON.stringify({
        dates: ["Sep 09", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21"],
        min: [19.0, 19.5, 20.0, 20.8, 21.5, 22.0, 21.8],
        max: [22.0, 22.5, 23.0, 23.8, 24.5, 25.0, 24.5],
        demandTons: [2100, 2150, 2200, 2280, 2350, 2400, 2380]
      }),
      volatility: 'Low (Stable Cold Chain Inventory)',
      advisory: 'Demand steady across food processors and institutional kitchens. Contract forward commitments at ₹21.50/kg farmgate.'
    }
  ];

  for (const f of forecasts) {
    insertForecast.run(
      f.id,
      f.commodity_id,
      f.region,
      f.hist,
      f.pred,
      f.volatility,
      f.advisory
    );
  }

  // 7. Orders (Linked to B2B Buyer)
  const insertOrder = db.prepare(`
    INSERT INTO orders_and_inquiries (
      id, user_id, order_type, commodity_id, quantity, buyer_name, contact_phone,
      destination_city, total_amount, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertOrder.run(
    'ORD-101',
    'USR-BUYER-01',
    'B2B_Bulk',
    'COMM-VEG-01',
    100,
    'Reliance Fresh Urban Hub',
    '+91-9820011223',
    'Mumbai',
    235000,
    'Confirmed',
    new Date().toISOString()
  );

  // 8. Produce Listings for E-Commerce Marketplace
  const insertListing = db.prepare(`
    INSERT INTO produce_listings (
      id, farmer_id, commodity_name, category, variety, available_qty,
      unit, farmgate_price_per_unit, mandi_reference_price, quality_grade,
      harvest_date, location_pin, image, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const enterpriseListings = [
    {
      id: 'LST-MANGO-01',
      farmer_id: 'USR-FARMER-ENTERPRISE',
      commodity_name: 'Ratnagiri Alphonso Mango (GI Tagged)',
      category: 'Fruit',
      variety: 'Alphonso Premium Export',
      available_qty: 450,
      unit: 'crate',
      farmgate_price_per_unit: 850.0,
      mandi_reference_price: 1350.0,
      quality_grade: 'Grade A+ Export',
      harvest_date: '2026-09-10',
      location_pin: 'Ratnagiri, Maharashtra',
      image: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-ONION-01',
      farmer_id: 'USR-FARMER-ENTERPRISE',
      commodity_name: 'Nashik Red Onion (Garwa Grade)',
      category: 'Vegetable',
      variety: 'Pusa Red / Garwa',
      available_qty: 1200,
      unit: 'kg',
      farmgate_price_per_unit: 24.5,
      mandi_reference_price: 38.0,
      quality_grade: 'Grade A (Storage Cured)',
      harvest_date: '2026-09-08',
      location_pin: 'Lasalgaon, Nashik, Maharashtra',
      image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-TOMATO-01',
      farmer_id: 'USR-FARMER-01',
      commodity_name: 'Kolar Hybrid Table Tomato',
      category: 'Vegetable',
      variety: 'Abhinav Firm Hybrid',
      available_qty: 600,
      unit: 'kg',
      farmgate_price_per_unit: 19.5,
      mandi_reference_price: 32.0,
      quality_grade: 'Grade A (Optimal Color)',
      harvest_date: '2026-09-11',
      location_pin: 'Kolar, Karnataka',
      image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-APPLE-01',
      farmer_id: 'USR-FARMER-01',
      commodity_name: 'Shimla Royal Delicious Apple',
      category: 'Fruit',
      variety: 'Royal Delicious Mountain Fresh',
      available_qty: 300,
      unit: 'crate',
      farmgate_price_per_unit: 1150.0,
      mandi_reference_price: 1850.0,
      quality_grade: 'Grade A+ Export',
      harvest_date: '2026-09-07',
      location_pin: 'Kotgarh, Shimla, HP',
      image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-ORANGE-01',
      farmer_id: 'USR-FARMER-ENTERPRISE',
      commodity_name: 'Nagpur Organic Mandarin Orange',
      category: 'Fruit',
      variety: 'Nagpur Santra Citrus',
      available_qty: 850,
      unit: 'kg',
      farmgate_price_per_unit: 34.0,
      mandi_reference_price: 52.0,
      quality_grade: 'Grade A (High Brix)',
      harvest_date: '2026-09-09',
      location_pin: 'Katol, Nagpur, Maharashtra',
      image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-WHEAT-01',
      farmer_id: 'USR-FPO-01',
      commodity_name: 'Sharbati Golden Farm Wheat',
      category: 'Grain',
      variety: 'Sehore Sharbati Extra Bold',
      available_qty: 2500,
      unit: 'quintal',
      farmgate_price_per_unit: 3100.0,
      mandi_reference_price: 4200.0,
      quality_grade: 'Grade A+ Grain',
      harvest_date: '2026-08-25',
      location_pin: 'Sehore, MP',
      image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-RICE-01',
      farmer_id: 'USR-FPO-01',
      commodity_name: 'Taraori Traditional Basmati Rice',
      category: 'Grain',
      variety: 'Aged 1121 Extra Long Grain',
      available_qty: 1800,
      unit: 'quintal',
      farmgate_price_per_unit: 5400.0,
      mandi_reference_price: 7800.0,
      quality_grade: 'Grade A+ Export',
      harvest_date: '2026-08-20',
      location_pin: 'Karnal, Haryana',
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    },
    {
      id: 'LST-POTATO-01',
      farmer_id: 'USR-FARMER-01',
      commodity_name: 'Agra Jyoti Chipsona Potato',
      category: 'Vegetable',
      variety: 'Chipsona High Solids',
      available_qty: 1500,
      unit: 'kg',
      farmgate_price_per_unit: 16.5,
      mandi_reference_price: 25.0,
      quality_grade: 'Grade A Processing',
      harvest_date: '2026-09-06',
      location_pin: 'Agra, Uttar Pradesh',
      image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
      status: 'AVAILABLE'
    }
  ];

  for (const l of enterpriseListings) {
    insertListing.run(
      l.id,
      l.farmer_id,
      l.commodity_name,
      l.category,
      l.variety,
      l.available_qty,
      l.unit,
      l.farmgate_price_per_unit,
      l.mandi_reference_price,
      l.quality_grade,
      l.harvest_date,
      l.location_pin,
      l.image,
      l.status,
      new Date().toISOString()
    );

    // Also populate produce_lots table
    try {
      db.prepare(`
        INSERT OR REPLACE INTO produce_lots (
          id, farmer_id, crop_name, category, variety, quantity_kg,
          farmgate_price, mandi_price, qc_grade, qc_hash, location,
          status, image, harvest_date, dispatch_schedule, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        l.id,
        l.farmer_id,
        l.commodity_name,
        l.category,
        l.variety,
        l.available_qty,
        l.farmgate_price_per_unit,
        l.mandi_reference_price,
        l.quality_grade,
        'SHA256: 7f8a91c2b4d90e8a7f6c5b4a3d2e1f0a',
        l.location_pin,
        'available',
        l.image,
        l.harvest_date,
        'Cold-Chain Reefer Pickup within 24h',
        new Date().toISOString()
      );
    } catch (err) {
      console.warn('Produce lot seed warning:', err.message);
    }
  }

  // 9. Seed Cart Items for Pending Buyer
  const insertCartItem = db.prepare(`
    INSERT INTO cart_items (id, buyer_id, listing_id, quantity, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertCartItem.run('CRT-DEMO-01', 'USR-BUYER-PENDING', 'LST-MANGO-01', 5, new Date().toISOString());
  insertCartItem.run('CRT-DEMO-02', 'USR-BUYER-PENDING', 'LST-ONION-01', 50, new Date().toISOString());

  // 10. Seed Orders with Double-Approval Escrow & Tracking
  const insertFullOrder = db.prepare(`
    INSERT INTO orders (
      id, order_number, buyer_id, farmer_id, seller_id, listing_id, lot_id,
      quantity, total_price, total_amount, payment_status, escrow_status,
      verification_status, tracking_status, pickup_schedule,
      delivery_address, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Order 1: PENDING OWNER VERIFICATION (Perfect for demonstrating Owner Double-Approval Queue)
  insertFullOrder.run(
    'ORD-TRACK-01',
    'KD-ORD-9482',
    'USR-BUYER-PENDING',
    'USR-FARMER-ENTERPRISE',
    'USR-FARMER-ENTERPRISE',
    'LST-ONION-01',
    'LST-ONION-01',
    150,
    3675.0,
    3675.0,
    'ESCROW_HELD',
    'held',
    'pending_owner',
    'pending_verification',
    'Awaiting Platform Owner Escrow Verification',
    'FreshMart Warehouse 4B, Bhiwandi, Mumbai, MH 421302',
    new Date(Date.now() - 3600000 * 4).toISOString(),
    new Date(Date.now() - 3600000 * 4).toISOString()
  );

  // Order 2: APPROVED & IN REEFER TRANSIT
  insertFullOrder.run(
    'ORD-TRACK-02',
    'KD-ORD-8821',
    'USR-BUYER-VERIFIED',
    'USR-FARMER-ENTERPRISE',
    'USR-FARMER-ENTERPRISE',
    'LST-MANGO-01',
    'LST-MANGO-01',
    25,
    21250.0,
    21250.0,
    'ESCROW_LOCKED_CONFIRMED',
    'held',
    'approved',
    'approved_escrow_locked',
    'Reefer pickup completed; In-transit to cold storage',
    'Reliance Retail Cold Depot, Vashi APMC Sector 19, Navi Mumbai',
    new Date(Date.now() - 3600000 * 12).toISOString(),
    new Date(Date.now() - 3600000 * 2).toISOString()
  );

  // Order 3: SETTLED & DELIVERED
  insertFullOrder.run(
    'ORD-TRACK-03',
    'KD-ORD-7714',
    'USR-BUYER-VERIFIED',
    'USR-FARMER-01',
    'USR-FARMER-01',
    'LST-TOMATO-01',
    'LST-TOMATO-01',
    80,
    1560.0,
    1560.0,
    'SETTLED_TO_FARMER',
    'settled',
    'approved',
    'delivered',
    'Delivery fulfilled at retail depot',
    'Reliance Fresh Hypermarket, Andheri East, Mumbai',
    new Date(Date.now() - 3600000 * 48).toISOString(),
    new Date(Date.now() - 3600000 * 6).toISOString()
  );

  // 11. Seed Mandi Rates for Agmarknet feed
  const mandiItems = [
    { comm: 'Nashik Red Onion', market: 'Lasalgaon APMC', state: 'Maharashtra', min: 18.0, max: 28.5, modal: 24.0 },
    { comm: 'Kolar Hybrid Tomato', market: 'Kolar APMC Market', state: 'Karnataka', min: 16.0, max: 25.0, modal: 22.0 },
    { comm: 'Agra Chipsona Potato', market: 'Fatehabad APMC', state: 'Uttar Pradesh', min: 14.5, max: 21.0, modal: 18.0 },
    { comm: 'Sharbati Milling Wheat', market: 'Khanna Mandi', state: 'Punjab', min: 26.0, max: 32.5, modal: 29.5 },
    { comm: 'Yellow Gold Soybean', market: 'Indore APMC Yard', state: 'Madhya Pradesh', min: 42.0, max: 49.0, modal: 46.5 }
  ];
  const todayDate = new Date().toISOString().split('T')[0];
  const insertMandi = db.prepare(`
    INSERT OR REPLACE INTO mandi_rates (id, commodity, market_name, state, min_price, max_price, modal_price, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  mandiItems.forEach(m => {
    insertMandi.run(`MANDI-${m.comm.replace(/\s+/g, '-').toUpperCase()}-${todayDate}`, m.comm, m.market, m.state, m.min, m.max, m.modal, todayDate);
  });

  // 12. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, performed_by, action, target_user_id, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('AUD-INIT-01', 'USR-ADMIN-ROOT', 'Platform initial seed with multi-role architecture and KYC controls', null, 'System initialized', new Date().toISOString());
  insertAudit.run('AUD-INIT-02', 'USR-FARMER-ENTERPRISE', 'Published Ratnagiri Alphonso Mango lot #LST-MANGO-01', 'USR-FARMER-ENTERPRISE', 'Lot published', new Date().toISOString());
  insertAudit.run('AUD-INIT-03', 'USR-BUYER-VERIFIED', 'Placed order KD-ORD-8821 with Escrow held', 'USR-BUYER-VERIFIED', 'Order placed', new Date().toISOString());

  console.log(`Database seeded successfully!
- ${demoUsers.length} Users with Hashed Passwords & KYC States
- ${enterpriseListings.length} Produce Listings in E-Commerce Catalog
- 2 Cart Items Pre-loaded for Buyer
- 3 Trackable Orders with 5-Stage Timelines
- ${categories.length} Categories
- ${commoditiesData.length} Commodities
- ${initialBatches.length} Batches
- ${qcRecords.length} QC Records
- ${forecasts.length} Forecasts
`);
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
