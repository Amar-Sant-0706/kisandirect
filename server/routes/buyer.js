const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'kisandirect-secure-jwt-key-2025';

// Optional auth helper: decodes user token if provided, without blocking unauthenticated requests
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

// GET /api/buyer/browse - Catalog listings with category/search filters (accessible to guests & authenticated buyers)
router.get('/browse', optionalAuth, (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT 
        l.*,
        u.name as farmer_name,
        u.phone as farmer_phone,
        u.district_state as farmer_location,
        CASE 
          WHEN l.mandi_reference_price > 0 THEN 
            ROUND(((l.farmgate_price_per_unit - l.mandi_reference_price) / l.mandi_reference_price) * 100) 
          ELSE 35 
        END as farmer_gain_pct,
        CASE 
          WHEN l.mandi_reference_price > 0 THEN 
            ROUND(((l.mandi_reference_price * 1.5 - l.farmgate_price_per_unit) / (l.mandi_reference_price * 1.5)) * 100) 
          ELSE 28 
        END as consumer_discount_pct
      FROM produce_listings l
      JOIN users u ON l.farmer_id = u.id
      WHERE l.status = 'AVAILABLE'
    `;
    const params = [];

    if (category && category.toLowerCase() !== 'all') {
      query += ` AND (LOWER(l.category) = LOWER(?) OR LOWER(l.category) LIKE LOWER(?))`;
      params.push(category, `%${category}%`);
    }

    if (search && search.trim()) {
      query += ` AND (LOWER(l.commodity_name) LIKE LOWER(?) OR LOWER(l.variety) LIKE LOWER(?) OR LOWER(u.district_state) LIKE LOWER(?))`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ` ORDER BY l.created_at DESC`;

    const rawListings = db.prepare(query).all(...params);
    const isApproved = req.user && (req.user.approval_status === 'APPROVED' || (req.user.role || '').toUpperCase() === 'OWNER');

    // Mask phone numbers if buyer is not approved and provide normalized property aliases
    const listings = rawListings.map(l => {
      let phone = l.farmer_phone || '+91-98220-12345';
      if (!isApproved) {
        phone = '+91 98******10';
      }
      return {
        ...l,
        farmer_phone: phone,
        farmgate_rate: l.farmgate_price_per_unit,
        mandi_rate: l.mandi_reference_price,
        farmer_fpo_name: l.farmer_name,
        quantity: l.available_qty,
        district_state: l.farmer_location || 'Maharashtra',
        image_url: l.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'
      };
    });

    res.json({
      success: true,
      count: listings.length,
      listings,
      buyerApprovalStatus: req.user ? req.user.approval_status : 'GUEST',
      buyerKycStatus: req.user ? req.user.kyc_status : 'NOT_SUBMITTED'
    });
  } catch (err) {
    console.error('Error browsing catalog:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// All protected endpoints below require valid JWT token and BUYER, OWNER or ADMIN role
router.use(verifyToken);
router.use(requireRole(['BUYER', 'OWNER', 'ADMIN']));

// GET /api/buyer/contact/:farmerId - Protected by Owner Approval!
router.get('/contact/:farmerId', requireApproved, (req, res) => {
  try {
    const farmerId = req.params.farmerId;
    const farmer = db.prepare(`
      SELECT id, name, phone, district_state, state_district, business_name, created_at 
      FROM users 
      WHERE id = ?
    `).get(farmerId);

    if (!farmer) {
      return res.status(404).json({ success: false, error: 'Farmer profile not found' });
    }

    const contactData = {
      farmerId: farmer.id,
      id: farmer.id,
      farmerName: farmer.name,
      name: farmer.name,
      phone: farmer.phone || '+91 98220 12345',
      location: farmer.district_state || farmer.state_district || 'Nashik, Maharashtra',
      verificationBadge: 'Verified Producer (FPO Certified)'
    };

    res.json({
      success: true,
      contact: contactData,
      farmer: contactData
    });
  } catch (err) {
    console.error('Error fetching farmer contact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/buyer/cart - Get current buyer's cart items
router.get('/cart', (req, res) => {
  try {
    const buyerId = req.user.id;
    const items = db.prepare(`
      SELECT 
        c.id as cart_item_id,
        c.quantity as cart_quantity,
        c.created_at as added_at,
        l.id as listing_id,
        l.commodity_name,
        l.category,
        l.variety,
        l.unit,
        l.available_qty,
        l.farmgate_price_per_unit,
        l.mandi_reference_price,
        l.image,
        l.quality_grade,
        u.name as farmer_name,
        u.district_state as farmer_location,
        (c.quantity * l.farmgate_price_per_unit) as subtotal_price,
        (c.quantity * l.mandi_reference_price * 1.45) as retail_mandi_value
      FROM cart_items c
      JOIN produce_listings l ON c.listing_id = l.id
      JOIN users u ON l.farmer_id = u.id
      WHERE c.buyer_id = ?
      ORDER BY c.created_at DESC
    `).all(buyerId);

    const totalPayable = items.reduce((sum, item) => sum + item.subtotal_price, 0);
    const totalMandiValue = items.reduce((sum, item) => sum + item.retail_mandi_value, 0);
    const totalSavings = Math.max(0, totalMandiValue - totalPayable);
    const escrowFee = Math.round(totalPayable * 0.015);

    const formattedCartItems = items.map(it => ({
      ...it,
      id: it.cart_item_id,
      cartItemId: it.cart_item_id,
      produce_name: it.commodity_name,
      commodity_name: it.commodity_name,
      unit_price: it.farmgate_price_per_unit,
      farmgate_price_per_unit: it.farmgate_price_per_unit,
      quantity: it.cart_quantity,
      cart_quantity: it.cart_quantity,
      subtotal: it.subtotal_price,
      subtotal_price: it.subtotal_price,
      image_url: it.image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80',
      image: it.image
    }));

    res.json({
      success: true,
      count: items.length,
      items: formattedCartItems,
      cart: {
        items: formattedCartItems,
        subtotal: +totalPayable.toFixed(2),
        escrow_fee: escrowFee,
        total: +(totalPayable + escrowFee).toFixed(2),
        savings: +totalSavings.toFixed(2)
      },
      summary: {
        itemsCount: items.length,
        totalPayable: +totalPayable.toFixed(2),
        totalMandiValue: +totalMandiValue.toFixed(2),
        totalSavings: +totalSavings.toFixed(2),
        middlemanCommission: 0,
        freightEstimate: 0,
        escrowGuaranteedShare: '72% Direct Farmer Payout'
      }
    });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/buyer/cart - Add, update, or remove produce items from cart
router.post('/cart', (req, res) => {
  try {
    const buyerId = req.user.id;
    const { listing_id, quantity = 1, action = 'add' } = req.body;

    if (!listing_id) {
      return res.status(400).json({ success: false, error: 'listing_id is required' });
    }

    const listing = db.prepare('SELECT * FROM produce_listings WHERE id = ?').get(listing_id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Produce listing not found' });
    }

    const qty = parseFloat(quantity) || 1;
    const existing = db.prepare('SELECT * FROM cart_items WHERE buyer_id = ? AND listing_id = ?').get(buyerId, listing_id);

    if (action === 'remove' || qty <= 0) {
      if (existing) {
        db.prepare('DELETE FROM cart_items WHERE id = ?').run(existing.id);
      }
      return res.json({ success: true, message: 'Item removed from cart' });
    }

    if (existing) {
      const newQty = action === 'set' ? qty : existing.quantity + qty;
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    } else {
      const cartId = `CRT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT INTO cart_items (id, buyer_id, listing_id, quantity, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(cartId, buyerId, listing_id, qty, new Date().toISOString());
    }

    res.json({
      success: true,
      message: `Updated cart for ${listing.commodity_name}`
    });
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/buyer/cart/:id - Update cart item quantity
router.put('/cart/:id', (req, res) => {
  try {
    const buyerId = req.user.id;
    const cartItemId = req.params.id;
    const { quantity } = req.body;
    const qty = parseFloat(quantity);

    if (isNaN(qty) || qty <= 0) {
      db.prepare('DELETE FROM cart_items WHERE id = ? AND buyer_id = ?').run(cartItemId, buyerId);
      return res.json({ success: true, message: 'Item removed from cart' });
    }

    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND buyer_id = ?').run(qty, cartItemId, buyerId);
    res.json({ success: true, message: 'Cart item updated successfully' });
  } catch (err) {
    console.error('Error updating cart item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/buyer/cart/:id - Remove item from cart
router.delete('/cart/:id', (req, res) => {
  try {
    const buyerId = req.user.id;
    const cartItemId = req.params.id;
    db.prepare('DELETE FROM cart_items WHERE id = ? AND buyer_id = ?').run(cartItemId, buyerId);
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    console.error('Error deleting cart item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/buyer/checkout - Convert cart items into orders (Requires APPROVED status)
router.post('/checkout', requireApproved, (req, res) => {
  try {
    const buyer = req.user;
    const { delivery_address = `${buyer.district_state || 'Mumbai, Maharashtra'}`, items: bodyItems } = req.body;

    let cartItems = db.prepare(`
      SELECT 
        c.*,
        l.commodity_name,
        l.farmer_id,
        l.farmgate_price_per_unit,
        l.unit,
        (c.quantity * l.farmgate_price_per_unit) as subtotal
      FROM cart_items c
      JOIN produce_listings l ON c.listing_id = l.id
      WHERE c.buyer_id = ?
    `).all(buyer.id);

    // If cart is empty, check if direct items were provided in req.body
    if ((!cartItems || cartItems.length === 0) && Array.isArray(bodyItems) && bodyItems.length > 0) {
      cartItems = bodyItems.map(it => {
        const listing = db.prepare('SELECT * FROM produce_listings WHERE id = ?').get(it.listing_id);
        const qty = Number(it.quantity) || 1;
        const price = Number(it.price_per_unit) || (listing ? listing.farmgate_price_per_unit : 100);
        return {
          listing_id: it.listing_id,
          commodity_name: listing ? listing.commodity_name : 'Marketplace Produce Lot',
          farmer_id: listing ? listing.farmer_id : 'FARMER-SYSTEM',
          farmgate_price_per_unit: price,
          unit: listing ? listing.unit : 'kg',
          quantity: qty,
          subtotal: +(qty * price).toFixed(2)
        };
      });
    }

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ success: false, error: 'Your cart is empty. Add produce to proceed.' });
    }

    const createdOrders = [];
    const now = new Date().toISOString();

    const insertOrder = db.prepare(`
      INSERT INTO orders (
        id, order_number, buyer_id, farmer_id, listing_id,
        quantity, total_price, payment_status, order_status,
        delivery_address, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ESCROW_HELD', 'ORDER_PLACED', ?, ?, ?)
    `);

    for (const item of cartItems) {
      const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      const orderNumber = `KD-ORD-${Math.floor(1000 + Math.random() * 9000)}`;

      insertOrder.run(
        orderId,
        orderNumber,
        buyer.id,
        item.farmer_id,
        item.listing_id,
        item.quantity,
        item.subtotal,
        delivery_address,
        now,
        now
      );

      createdOrders.push({
        id: orderId,
        order_number: orderNumber,
        commodity_name: item.commodity_name,
        quantity: item.quantity,
        unit: item.unit,
        total_price: item.subtotal,
        payment_status: 'ESCROW_HELD',
        order_status: 'ORDER_PLACED'
      });

      // Audit log
      try {
        db.prepare(`
          INSERT INTO audit_logs (id, actor_id, action_description, timestamp)
          VALUES (?, ?, ?, ?)
        `).run(`AUD-${Date.now()}`, buyer.id, `Placed order ${orderNumber} for ₹${item.subtotal}`, now);
      } catch (e) {}
    }

    // Clear buyer's cart if any
    try {
      db.prepare('DELETE FROM cart_items WHERE buyer_id = ?').run(buyer.id);
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Checkout successful! ${createdOrders.length} order(s) placed and secured in Escrow.`,
      order: createdOrders[0] || null,
      orders: createdOrders,
      delivery_address
    });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/buyer/orders - Returns buyer's order history with 5-stage tracking
router.get('/orders', (req, res) => {
  try {
    const buyerId = req.user.id;
    const orders = db.prepare(`
      SELECT 
        o.*,
        o.total_price as total_amount,
        l.commodity_name,
        l.commodity_name as produce_name,
        l.category,
        l.unit,
        l.farmgate_price_per_unit,
        l.image as listing_image,
        l.image as image_url,
        u.name as farmer_name,
        u.phone as farmer_phone,
        u.district_state as farmer_location
      FROM orders o
      JOIN produce_listings l ON o.listing_id = l.id
      JOIN users u ON o.farmer_id = u.id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
    `).all(buyerId);

    // Map each order to 5-stage timeline completion index
    const stages = ['ORDER_PLACED', 'FARMER_PACKING', 'REEFER_PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const ordersWithTimeline = orders.map(ord => {
      const stageIdx = stages.indexOf(ord.order_status);
      return {
        ...ord,
        total_amount: ord.total_price || ord.total_amount,
        produce_name: ord.commodity_name || ord.produce_name,
        stageIndex: stageIdx >= 0 ? stageIdx : 0,
        stageName: ord.order_status.replace(/_/g, ' ')
      };
    });

    res.json({
      success: true,
      count: orders.length,
      orders: ordersWithTimeline
    });
  } catch (err) {
    console.error('Error fetching buyer orders:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
