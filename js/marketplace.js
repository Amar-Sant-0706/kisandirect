/**
 * KisanDirect AI - Dynamic Marketplace, Cart & Order Lifecycle Tracker
 * Connects directly to multi-role endpoints: /api/buyer, /api/farmer, /api/admin
 */

window.MarketplaceModule = {
  activeFilter: 'all',
  searchQuery: '',
  cartItems: [],
  buyerOrders: [],

  async init() {
    await KisanData.loadInitialData();
    this.renderKycBanner();
    this.populateListingModalCommodities();
    await this.renderProducts();
    await this.syncCart();
    this.bindEvents();
  },

  getAuthHeader() {
    const token = localStorage.getItem('kd_auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  getCurrentUser() {
    try {
      const u = localStorage.getItem('kd_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  renderKycBanner() {
    const container = document.getElementById('buyerKycBannerContainer');
    if (!container) return;

    const user = this.getCurrentUser();
    if (!user) return;

    const role = (user.role || '').toUpperCase();
    if (role === 'BUYER' || role === 'B2B_BUYER' || role === 'CONSUMER') {
      const isApproved = user.approval_status === 'APPROVED';

      if (!isApproved) {
        container.innerHTML = `
          <div class="kyc-banner-pending" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i data-lucide="shield-alert" style="color: #f59e0b; width: 24px; height: 24px; flex-shrink: 0;"></i>
              <div>
                <strong style="color: #f59e0b; font-size: 0.95rem;">Business Account Under Owner Verification</strong>
                <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 2px;">
                  Your Business Account (GSTIN) is under verification by the Platform Owner. You can browse crops; direct checkout and farmer contacts remain locked.
                </div>
              </div>
            </div>
            <span class="badge badge-warning" style="font-size: 0.72rem; padding: 4px 8px;">PENDING APPROVAL</span>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="kyc-banner-approved" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 12px; padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i data-lucide="shield-check" style="color: #10b981; width: 24px; height: 24px; flex-shrink: 0;"></i>
              <div>
                <strong style="color: #10b981; font-size: 0.95rem;">Verified Enterprise Buyer (GSTIN Approved)</strong>
                <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">
                  Full checkout and direct farmgate contacts unlocked. 100% Escrow protected.
                </div>
              </div>
            </div>
            <span class="badge badge-grade-a" style="font-size: 0.72rem; padding: 4px 8px;">ACCOUNT APPROVED</span>
          </div>
        `;
      }
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    }
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('marketSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderProducts();
      });
    }

    // Category pills
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        filterPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeFilter = e.currentTarget.getAttribute('data-category');
        this.renderProducts();
      });
    });

    // Farmer Listing Form
    const listingForm = document.getElementById('farmerListingForm');
    if (listingForm) {
      listingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFarmerListingSubmit();
      });
    }

    // Listing dynamic profit calculator
    const farmgateInput = document.getElementById('newCropPrice');
    if (farmgateInput) {
      farmgateInput.addEventListener('input', () => this.updateListingProfitPreview());
    }

    const commSelect = document.getElementById('newCropCommoditySelect');
    if (commSelect) {
      commSelect.addEventListener('change', (e) => this.onListingCommodityChange(e.target.value));
    }
  },

  async renderProducts() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;

    let listings = [];
    try {
      const res = await fetch('/api/buyer/browse', {
        headers: this.getAuthHeader()
      });
      const data = await res.json();
      if (data.success && data.listings) {
        listings = data.listings;
      }
    } catch (e) {
      console.warn('Error fetching buyer browse listings, fallback to local batches:', e);
    }

    if (listings.length === 0 && KisanData.batches) {
      listings = KisanData.batches.map(b => ({
        id: b.id,
        lot_number: b.lot_number,
        commodity_id: b.commodity_id,
        commodity_name: b.commodity_name,
        category: b.category,
        variety: b.variety,
        farmer_fpo_name: b.farmer_fpo_name,
        farmer_id: b.user_id || 2,
        farmer_phone: '9876543210',
        district_state: b.pickup_location,
        quantity: b.quantity,
        unit: b.unit,
        quality_grade: b.quality_grade,
        harvest_date: b.harvest_date,
        farmgate_rate: b.farmgate_rate,
        mandi_rate: b.mandi_rate,
        image_url: b.commodity_image || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'
      }));
    }

    // Apply category filter
    if (this.activeFilter !== 'all') {
      listings = listings.filter(item => {
        const cat = (item.category || '').toLowerCase();
        if (this.activeFilter === 'grains') {
          return cat === 'grains' || cat === 'pulses';
        }
        return cat === this.activeFilter.toLowerCase();
      });
    }

    // Apply search query
    if (this.searchQuery) {
      listings = listings.filter(item =>
        (item.commodity_name || '').toLowerCase().includes(this.searchQuery) ||
        (item.farmer_fpo_name || '').toLowerCase().includes(this.searchQuery) ||
        (item.district_state || '').toLowerCase().includes(this.searchQuery)
      );
    }

    if (listings.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #94a3b8;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🌾</div>
          <h4 style="color: #fff;">No farm produce listings match your criteria</h4>
          <p>Try switching category filters or search terms.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = listings.map(item => {
      const directPrice = Number(item.farmgate_price_per_unit || item.farmgate_rate || 0);
      const mandiBenchmark = Number(item.mandi_reference_price || item.mandi_rate || Math.round(directPrice * 1.55));
      const traditionalMandiRetail = Math.round(mandiBenchmark > directPrice ? mandiBenchmark * 1.15 : directPrice * 1.55);
      const savingsPerUnit = Math.max(0, traditionalMandiRetail - directPrice).toFixed(0);
      const savingsPct = traditionalMandiRetail > 0 ? Math.round((savingsPerUnit / traditionalMandiRetail) * 100) : 35;

      const farmerName = String(item.farmer_name || item.farmer_fpo_name || 'Verified Farmer');
      const location = String(item.farmer_location || item.district_state || 'Maharashtra');
      const quantity = (item.available_qty !== undefined ? item.available_qty : (item.quantity || 100));
      const unit = item.unit || 'kg';
      const lotNumber = item.lot_number || item.id;
      const imageUrl = item.image || item.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80';
      const grade = item.quality_grade || 'Grade A Export';
      const gradeClass = grade.includes('Grade A') ? 'badge-grade-a' : 'badge-organic';

      const safeCommName = String(item.commodity_name || 'Produce').replace(/'/g, "\\'");
      const safeFarmerName = farmerName.replace(/'/g, "\\'");
      const safeLocation = location.replace(/'/g, "\\'");

      return `
        <div class="myntra-card" id="card-${item.id}">
          <div class="myntra-img-wrapper">
            <img src="${imageUrl}" alt="${safeCommName}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'" />
            <div class="myntra-overlay-badge">
              <i data-lucide="award" style="width: 12px; height: 12px;"></i>
              <span>${grade}</span>
            </div>
            <div class="myntra-savings-tag">
              Save ₹${savingsPerUnit}/${unit} (${savingsPct}% Off)
            </div>
          </div>

          <div class="myntra-card-body">
            <div class="myntra-farmer-info">
              <span class="myntra-farmer-name">
                <i data-lucide="tractor" style="width: 13px; height: 13px; color: #10b981;"></i>
                ${farmerName}
              </span>
              <span><i data-lucide="map-pin" style="width: 12px; height: 12px; display: inline;"></i> ${location}</span>
            </div>

            <h4 class="myntra-title">${item.commodity_name} <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">(${item.variety || 'Standard'})</span></h4>

            <div class="myntra-price-row">
              <span class="myntra-current-price">₹${directPrice}</span>
              <span class="myntra-unit-text">/ ${unit}</span>
              <span class="myntra-mandi-price">₹${traditionalMandiRetail}</span>
            </div>

            <div class="myntra-card-meta">
              <span>Lot #${lotNumber}</span>
              <span style="color: #10b981; font-weight: 600;">Available: ${quantity} ${unit}</span>
            </div>

            <div class="myntra-btn-group">
              <button class="btn-add-cart" onclick="MarketplaceModule.addToCart('${item.id}', '${safeCommName}', ${directPrice}, '${unit}', '${imageUrl}', '${safeFarmerName}')">
                <i data-lucide="shopping-cart" style="width: 15px; height: 15px;"></i> Add to Cart
              </button>
              <button class="btn-contact-farmer" onclick="MarketplaceModule.contactFarmer('${item.farmer_id || 2}', '${safeFarmerName}', '${safeLocation}')" title="Direct Contact Farmer">
                <i data-lucide="phone" style="width: 15px; height: 15px;"></i> Contact
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide && lucide.createIcons) lucide.createIcons();
  },

  // Contact Farmer (With KYC Gate enforcement)
  async contactFarmer(farmerId, farmerName, location) {
    const token = localStorage.getItem('kd_auth_token');
    if (!token) {
      window.location.href = `/login.html?redirect=/marketplace.html`;
      return;
    }

    try {
      const res = await fetch(`/api/buyer/contact/${farmerId}`, {
        headers: this.getAuthHeader()
      });

      if (res.status === 403) {
        // KYC Gate Enforced!
        const user = this.getCurrentUser();
        const statusText = user ? user.kyc_status : 'PENDING REVIEW';
        document.getElementById('kycDialogStatusText').textContent = statusText;
        this.openModal('kycLockModal');
        return;
      }

      const data = await res.json();
      if (data.success && data.farmer) {
        const modalBody = document.getElementById('farmerContactBody');
        modalBody.innerHTML = `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 0.75rem; color: #10b981; font-weight: 700; text-transform: uppercase;">Verified Direct Farmgate Contact</div>
            <h4 style="font-size: 1.15rem; color: #fff; margin: 4px 0;">${data.farmer.name}</h4>
            <div style="font-size: 0.82rem; color: #cbd5e1;">Location: ${data.farmer.district_state}</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.05); padding: 10px 14px; border-radius: 8px;">
              <span style="font-size: 0.85rem; color: #94a3b8;"><i data-lucide="phone" style="width: 14px; height: 14px; display: inline;"></i> Direct Mobile:</span>
              <strong style="color: #fff; font-size: 0.95rem;">${data.farmer.phone}</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.05); padding: 10px 14px; border-radius: 8px;">
              <span style="font-size: 0.85rem; color: #94a3b8;"><i data-lucide="mail" style="width: 14px; height: 14px; display: inline;"></i> Email:</span>
              <strong style="color: #fff; font-size: 0.95rem;">${data.farmer.email}</strong>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 255, 255, 0.05); padding: 10px 14px; border-radius: 8px;">
              <span style="font-size: 0.85rem; color: #94a3b8;"><i data-lucide="check-circle" style="width: 14px; height: 14px; display: inline;"></i> GSTIN / FPO Auth:</span>
              <strong style="color: #10b981; font-size: 0.85rem;">DOCA Certified Producer</strong>
            </div>
          </div>

          <a href="tel:${data.farmer.phone}" class="btn btn-primary" style="width: 100%; text-decoration: none; justify-content: center;">
            <i data-lucide="phone-call"></i> Call Farmer Now
          </a>
        `;
        this.openModal('farmerContactModal');
        if (window.lucide && lucide.createIcons) lucide.createIcons();
      }
    } catch (err) {
      console.error('Error contacting farmer:', err);
    }
  },

  // Cart Management
  async syncCart() {
    const token = localStorage.getItem('kd_auth_token');
    if (!token) return;

    try {
      const res = await fetch('/api/buyer/cart', {
        headers: this.getAuthHeader()
      });
      const data = await res.json();
      if (data.success) {
        if (data.cart && Array.isArray(data.cart.items)) {
          this.cartItems = data.cart.items;
          this.updateCartBadge();
          this.renderCartDrawerItems(data.cart);
        } else if (Array.isArray(data.items)) {
          const formatted = data.items.map(it => ({
            ...it,
            id: it.cart_item_id || it.id,
            produce_name: it.commodity_name || it.produce_name || 'Produce Lot',
            unit_price: it.farmgate_price_per_unit || it.unit_price || 0,
            quantity: it.cart_quantity || it.quantity || 1,
            subtotal: it.subtotal_price || it.subtotal || 0,
            unit: it.unit || 'kg',
            image_url: it.image || it.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80'
          }));
          this.cartItems = formatted;
          const subtotal = data.summary ? data.summary.totalPayable : formatted.reduce((s, x) => s + x.subtotal, 0);
          const escrowFee = Math.round(subtotal * 0.015);
          this.updateCartBadge();
          this.renderCartDrawerItems({
            items: formatted,
            subtotal,
            escrow_fee: escrowFee,
            total: subtotal + escrowFee
          });
        }
      }
    } catch (err) {
      console.warn('Error syncing cart:', err);
    }
  },

  async addToCart(listingId, name, price, unit, image, farmerName) {
    const token = localStorage.getItem('kd_auth_token');
    if (!token) {
      window.location.href = `/login.html?redirect=/marketplace.html`;
      return;
    }

    try {
      const res = await fetch('/api/buyer/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          listing_id: listingId,
          produce_name: name,
          unit_price: price,
          quantity: 25,
          unit: unit,
          action: 'add'
        })
      });

      const data = await res.json();
      if (data.success) {
        await this.syncCart();
        this.openCartDrawer();
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
    }
  },

  async updateCartItemQuantity(cartItemId, newQty) {
    if (newQty <= 0) {
      // Remove item
      try {
        await fetch(`/api/buyer/cart/${cartItemId}`, {
          method: 'DELETE',
          headers: this.getAuthHeader()
        });
        await this.syncCart();
      } catch (e) {}
    } else {
      try {
        await fetch(`/api/buyer/cart/${cartItemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeader()
          },
          body: JSON.stringify({ quantity: newQty })
        });
        await this.syncCart();
      } catch (e) {}
    }
  },

  updateCartBadge() {
    const count = this.cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const navCount = document.getElementById('cartBadgeCount');
    const heroCount = document.getElementById('heroCartCount');
    const drawerBadge = document.getElementById('drawerCartBadge');
    
    if (navCount) navCount.textContent = count;
    if (heroCount) heroCount.textContent = count;
    if (drawerBadge) drawerBadge.textContent = `${this.cartItems.length} Lots (${count} units)`;
  },

  renderCartDrawerItems(cartData) {
    const container = document.getElementById('cartDrawerItems');
    if (!container) return;

    if (!cartData || !cartData.items || cartData.items.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🛒</div>
          <h4 style="color: #fff; margin-bottom: 4px;">Your Farm Basket is Empty</h4>
          <p style="font-size: 0.8rem;">Browse fresh farmgate produce to add lots directly from verified farmers.</p>
        </div>
      `;
      document.getElementById('cartSubtotal').textContent = '₹ 0';
      document.getElementById('cartEscrowFee').textContent = '₹ 0';
      document.getElementById('cartTotalPayable').textContent = '₹ 0';
      return;
    }

    container.innerHTML = cartData.items.map(item => `
      <div class="cart-item-row" id="cart-row-${item.id}">
        <img src="${item.image_url || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80'}" class="cart-item-thumb" alt="${item.produce_name}" />
        <div class="cart-item-details">
          <h5>${item.produce_name}</h5>
          <div class="cart-item-fpo">Direct from Verified Farmer Lot</div>
          <div class="cart-item-price">₹${item.unit_price} / ${item.unit || 'kg'} &bull; Subtotal: ₹${item.subtotal}</div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
          <div class="cart-stepper">
            <button class="cart-step-btn" onclick="MarketplaceModule.updateCartItemQuantity('${item.id}', ${item.quantity - 5})">-</button>
            <span style="font-size: 0.8rem; font-weight: 700; color: #fff; min-width: 24px; text-align: center;">${item.quantity}</span>
            <button class="cart-step-btn" onclick="MarketplaceModule.updateCartItemQuantity('${item.id}', ${item.quantity + 5})">+</button>
          </div>
          <button onclick="MarketplaceModule.updateCartItemQuantity('${item.id}', 0)" style="background: none; border: none; color: #ef4444; font-size: 0.72rem; cursor: pointer;">
            <i data-lucide="trash-2" style="width: 12px; height: 12px; display: inline;"></i> Remove
          </button>
        </div>
      </div>
    `).join('');

    const subtotal = cartData.subtotal || 0;
    const escrowFee = cartData.escrow_fee || Math.round(subtotal * 0.015);
    const total = cartData.total || (subtotal + escrowFee);

    document.getElementById('cartSubtotal').textContent = `₹ ${subtotal.toLocaleString('en-IN')}`;
    document.getElementById('cartEscrowFee').textContent = `₹ ${escrowFee.toLocaleString('en-IN')}`;
    document.getElementById('cartTotalPayable').textContent = `₹ ${total.toLocaleString('en-IN')}`;

    if (window.lucide && lucide.createIcons) lucide.createIcons();
  },

  openCartDrawer() {
    this.syncCart();
    document.getElementById('cartDrawerBackdrop').classList.add('open');
    document.getElementById('cartDrawer').classList.add('open');
  },

  closeCartDrawer() {
    document.getElementById('cartDrawerBackdrop').classList.remove('open');
    document.getElementById('cartDrawer').classList.remove('open');
  },

  async handleCheckout() {
    const btn = document.getElementById('btnProceedCheckout');
    const address = document.getElementById('checkoutAddress').value.trim();

    if (!address) {
      alert('Please enter a delivery destination address.');
      return;
    }

    if (this.cartItems.length === 0) {
      alert('Your cart is empty.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm"></span> Securing Escrow & Placing Order...`;

    try {
      const res = await fetch('/api/buyer/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          delivery_address: address,
          payment_method: 'ESCROW_SIMULATED'
        })
      });

      const data = await res.json();
      if (res.status === 403 && (data.error === 'ACCOUNT_PENDING_OWNER_APPROVAL' || data.error === 'KYC_PENDING')) {
        alert("Your Business Account (GSTIN) is under verification by the Platform Owner. Direct checkout and farmer contacts remain locked until approved.");
        return;
      }

      if (data.success) {
        this.closeCartDrawer();
        await this.syncCart();
        alert(`✓ Order ${data.order.order_number} successfully placed! Funds held safely in 100% Escrow.`);
        this.openOrdersModal();
      } else {
        alert(data.error || data.message || 'Checkout failed.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Checkout error occurred.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="lock"></i> Place Order via Escrow (Simulated)`;
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    }
  },

  // 5-Stage Order Tracking Timeline Modal
  async openOrdersModal() {
    const token = localStorage.getItem('kd_auth_token');
    if (!token) {
      window.location.href = `/login.html?redirect=/marketplace.html`;
      return;
    }

    const modalBody = document.getElementById('ordersTrackingBody');
    modalBody.innerHTML = `<div style="text-align: center; padding: 2rem; color: #94a3b8;">Loading order tracking history...</div>`;
    this.openModal('ordersTrackingModal');

    try {
      const res = await fetch('/api/buyer/orders', {
        headers: this.getAuthHeader()
      });
      const data = await res.json();

      if (data.success && data.orders && data.orders.length > 0) {
        this.buyerOrders = data.orders;
        this.renderOrdersTimeline(data.orders);
      } else {
        modalBody.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">📦</div>
            <h4 style="color: #fff;">No Orders Placed Yet</h4>
            <p style="font-size: 0.85rem;">Items ordered through the direct farm marketplace will appear here with live 5-stage tracking.</p>
          </div>
        `;
      }
    } catch (err) {
      modalBody.innerHTML = `<div style="color: #ef4444; text-align: center;">Error loading orders.</div>`;
    }
  },

  renderOrdersTimeline(orders) {
    const modalBody = document.getElementById('ordersTrackingBody');
    if (!modalBody) return;

    const STAGES = [
      { key: 'ORDER_PLACED', label: '1. Order Placed', icon: 'file-check', desc: 'Escrow locked' },
      { key: 'FARMER_PACKING', label: '2. Farmer Packing', icon: 'package', desc: 'Grading & sorting' },
      { key: 'REEFER_PICKED_UP', label: '3. Reefer Picked Up', icon: 'truck', desc: 'Cold-chain loaded' },
      { key: 'IN_TRANSIT', label: '4. In Transit', icon: 'navigation', desc: 'GPS route active' },
      { key: 'DELIVERED', label: '5. Delivered', icon: 'check-circle-2', desc: 'Escrow settled' }
    ];

    modalBody.innerHTML = orders.map(order => {
      // Determine stage index
      const stageIdx = STAGES.findIndex(s => s.key === order.order_status);
      const activeIdx = stageIdx >= 0 ? stageIdx : 0;
      const progressPct = Math.round((activeIdx / (STAGES.length - 1)) * 100);

      const escrowBadge = order.escrow_status === 'ESCROW_RELEASED'
        ? `<span class="badge badge-grade-a">ESCROW RELEASED (T+1 Payout)</span>`
        : `<span class="badge badge-warning">ESCROW HELD (Protected)</span>`;

      return `
        <div class="order-tracking-card" id="order-card-${order.id}">
          <div class="order-tracking-header">
            <div>
              <span class="order-id-badge">#${order.order_number}</span>
              <strong style="color: #fff; font-size: 1.05rem; margin-left: 8px;">${order.produce_name} (${order.quantity} ${order.unit})</strong>
              <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 3px;">
                Farmer / FPO: <strong>${order.farmer_name || 'Direct Farm Producer'}</strong> • Ordered on: ${new Date(order.created_at).toLocaleString()}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.15rem; font-weight: 800; color: #10b981;">₹ ${Number(order.total_amount).toLocaleString('en-IN')}</div>
              <div>${escrowBadge}</div>
            </div>
          </div>

          <!-- Cold-Chain Telemetry Pill -->
          <div style="background: rgba(2, 132, 199, 0.1); border: 1px solid rgba(2, 132, 199, 0.3); border-radius: 8px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #38bdf8; margin-bottom: 1rem;">
            <i data-lucide="thermometer-snowflake" style="width: 14px; height: 14px;"></i>
            <span><strong>IoT Cold-Chain Telemetry:</strong> 3.8°C Reefer Maintained &bull; Carrier: BharatCold Fleet #419</span>
          </div>

          <!-- 5-STAGE TIMELINE TRACKER -->
          <div class="timeline-track-container">
            <div class="timeline-rail">
              <div class="timeline-rail-fill" style="width: ${progressPct}%;"></div>
            </div>
            <div class="timeline-steps">
              ${STAGES.map((s, idx) => {
                let stateClass = '';
                if (idx < activeIdx) stateClass = 'completed';
                else if (idx === activeIdx) stateClass = 'active';

                return `
                  <div class="timeline-step ${stateClass}">
                    <div class="step-node">
                      <i data-lucide="${s.icon}" style="width: 18px; height: 18px;"></i>
                    </div>
                    <span class="step-title">${s.label}</span>
                    <span class="step-time">${s.desc}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: #94a3b8; padding-top: 0.75rem; border-top: 1px solid rgba(255, 255, 255, 0.06);">
            <span>Delivery Destination: <strong>${order.delivery_address || 'Central Fulfillment Warehouse'}</strong></span>
            <span>Tracking Status: <strong style="color: #10b981;">${order.order_status}</strong></span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide && lucide.createIcons) lucide.createIcons();
  },

  // Farmer Hub: Inbound Orders Management
  async loadFarmerOrders() {
    const tbody = document.getElementById('farmerOrdersTableBody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/farmer/orders', {
        headers: this.getAuthHeader()
      });
      const data = await res.json();

      if (data.success && data.orders && data.orders.length > 0) {
        tbody.innerHTML = data.orders.map(o => {
          let actionBtn = '';
          if (o.order_status === 'ORDER_PLACED') {
            actionBtn = `
              <button class="btn btn-primary btn-sm" onclick="MarketplaceModule.updateFarmerOrderStatus('${o.id}', 'FARMER_PACKING')">
                <i data-lucide="package"></i> Mark Packing
              </button>
            `;
          } else if (o.order_status === 'FARMER_PACKING') {
            actionBtn = `
              <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #0284c7, #0369a1);" onclick="MarketplaceModule.updateFarmerOrderStatus('${o.id}', 'REEFER_PICKED_UP')">
                <i data-lucide="truck"></i> Hand to Reefer
              </button>
            `;
          } else if (o.order_status === 'REEFER_PICKED_UP' || o.order_status === 'IN_TRANSIT') {
            actionBtn = `<span style="font-size: 0.75rem; color: #0284c7; font-weight: 600;">In Logistics Custody</span>`;
          } else if (o.order_status === 'DELIVERED') {
            actionBtn = `<span style="font-size: 0.75rem; color: #10b981; font-weight: 700;">✓ Settled to Bank</span>`;
          }

          const prodName = o.commodity_name || o.produce_name || 'Produce';
          const totalAmt = o.total_price || o.total_amount || 0;

          return `
            <tr>
              <td><strong style="color: #10b981;">#${o.order_number}</strong></td>
              <td>
                <div style="font-weight: 600; color: #fff;">${o.buyer_name || 'Buyer'}</div>
                <div style="font-size: 0.72rem; color: #94a3b8;">${o.buyer_business || ''}</div>
              </td>
              <td><strong>${prodName}</strong> (${o.quantity} ${o.unit || 'kg'})</td>
              <td><strong style="color: #10b981;">₹ ${Number(totalAmt).toLocaleString('en-IN')}</strong></td>
              <td style="font-size: 0.78rem;">${o.delivery_address || 'India'}</td>
              <td><span class="badge ${o.order_status === 'DELIVERED' ? 'badge-grade-a' : 'badge-warning'}">${o.order_status}</span></td>
              <td>${actionBtn}</td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">
              No buyer orders placed for your farm harvest batches yet.
            </td>
          </tr>
        `;
      }
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; text-align: center;">Error loading orders.</td></tr>`;
    }
  },

  async updateFarmerOrderStatus(orderId, newStatus) {
    try {
      const res = await fetch(`/api/farmer/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({ order_status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        alert(`✓ Order status updated to ${newStatus}`);
        await this.loadFarmerOrders();
      } else {
        alert(data.error || 'Failed to update order status');
      }
    } catch (e) {
      alert('Error updating order status');
    }
  },

  // Modal Helpers
  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  },

  openCartModal() {
    this.openCartDrawer();
  },

  openFarmerListingModal() {
    this.openModal('farmerListingModal');
  },

  // Farmer Listing Submission
  async handleFarmerListingSubmit() {
    const commSelect = document.getElementById('newCropCommoditySelect');
    const customInput = document.getElementById('newCropCustomName');
    const fpo = document.getElementById('newCropFpo').value.trim();
    const location = document.getElementById('newCropLocation').value.trim();
    const price = parseFloat(document.getElementById('newCropPrice').value);
    const qtyStr = document.getElementById('newCropQuantity').value.trim();
    const grade = document.getElementById('newCropGrade').value;
    const category = document.getElementById('newCropCategory').value;

    let commodityId = commSelect.value;
    let commodityName = '';

    if (commodityId === '__NEW__') {
      commodityName = customInput.value.trim();
      commodityId = commodityName.toLowerCase().replace(/\s+/g, '-');
    } else {
      const selectedOpt = commSelect.options[commSelect.selectedIndex];
      commodityName = selectedOpt ? selectedOpt.getAttribute('data-name') : 'Produce';
    }

    const qtyNumber = parseInt(qtyStr) || 100;
    const unit = qtyStr.includes('Quintal') ? 'Quintals' : 'kg';

    try {
      const res = await fetch('/api/farmer/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify({
          commodity_name: commodityName,
          category: category,
          variety: 'Standard Grade',
          quantity: qtyNumber,
          unit: unit,
          farmgate_rate: price,
          mandi_rate: +(price * 0.7).toFixed(2),
          quality_grade: grade,
          pickup_location: location,
          district_state: location
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`✓ Farm harvest lot published successfully! Lot #${data.listing.lot_number}`);
        this.closeModal('farmerListingModal');
        await this.renderFarmerBatches();
      } else {
        alert(data.error || 'Failed to list harvest batch');
      }
    } catch (err) {
      console.error('Listing error:', err);
    }
  },

  async renderFarmerBatches() {
    const tbody = document.getElementById('farmerBatchesTableBody');
    if (!tbody) return;

    try {
      const res = await fetch('/api/farmer/my-listings', {
        headers: this.getAuthHeader()
      });
      const data = await res.json();

      let listings = [];
      if (data.success && data.listings) {
        listings = data.listings;
      }

      const countEl = document.getElementById('farmerActiveLotsCount');
      if (countEl) countEl.textContent = `${listings.length} Active Lots`;

      if (listings.length > 0) {
        tbody.innerHTML = listings.map(b => {
          const farmRate = b.farmgate_price_per_unit || b.farmgate_rate || 0;
          const mandiRate = b.mandi_reference_price || b.mandi_rate || Math.round(farmRate * 0.7);
          const quantity = b.available_qty !== undefined ? b.available_qty : (b.quantity || 0);
          const harvestDate = b.harvest_date || (b.created_at ? b.created_at.split('T')[0] : 'Today');

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: #fff;">${b.commodity_name}</div>
                <div style="font-size: 0.72rem; color: #94a3b8;">Lot #${b.lot_number || b.id} &bull; Harvest: ${harvestDate}</div>
              </td>
              <td>${quantity} ${b.unit || 'kg'}</td>
              <td><span class="badge badge-grade-a">${b.quality_grade || 'Grade A'}</span></td>
              <td><strong style="color: #10b981;">₹ ${farmRate} / ${b.unit || 'kg'}</strong></td>
              <td><span style="color: #ef4444; font-size: 0.82rem; text-decoration: line-through;">₹ ${mandiRate}</span> <small style="color: #10b981;">(+42%)</small></td>
              <td><span style="font-size: 0.78rem; color: #38bdf8;">Tomorrow 08:30 AM</span></td>
              <td><span class="badge badge-organic">${b.status || 'AVAILABLE'}</span></td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2rem; color: #94a3b8;">
              No harvest batches listed yet. Click "+ List New Harvest Batch" above!
            </td>
          </tr>
        `;
      }
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    } catch (e) {
      console.warn('Error loading farmer batches:', e);
    }
  },

  populateListingModalCommodities() {
    const select = document.getElementById('newCropCommoditySelect');
    if (!select) return;

    select.innerHTML = `
      <option value="">-- Select Any Registered Crop / Fruit / Grain --</option>
      <option value="__NEW__" style="color: #10b981; font-weight: 700;">+ Add New Produce / Crop (Dynamic Entry)</option>
    `;

    const grouped = {};
    (KisanData.commodities || []).forEach(c => {
      if (!grouped[c.category]) grouped[c.category] = [];
      grouped[c.category].push(c);
    });

    for (const [cat, list] of Object.entries(grouped)) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = cat;
      list.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (Mandi Base: ₹${c.base_mandi_benchmark_rate}/${c.standard_unit})`;
        opt.setAttribute('data-category', c.category);
        opt.setAttribute('data-unit', c.standard_unit);
        opt.setAttribute('data-base', c.base_mandi_benchmark_rate);
        opt.setAttribute('data-name', c.name);
        optGroup.appendChild(opt);
      });
      select.appendChild(optGroup);
    }
  },

  onListingCommodityChange(val) {
    const customRow = document.getElementById('newCropCustomRow');
    const customInput = document.getElementById('newCropCustomName');
    const catSelect = document.getElementById('newCropCategory');
    const priceInput = document.getElementById('newCropPrice');

    if (val === '__NEW__') {
      if (customRow) customRow.style.display = 'block';
      if (customInput) customInput.focus();
      return;
    }
    if (customRow) customRow.style.display = 'none';

    const select = document.getElementById('newCropCommoditySelect');
    const selectedOpt = select ? select.options[select.selectedIndex] : null;
    if (selectedOpt && val) {
      const cat = selectedOpt.getAttribute('data-category');
      const base = parseFloat(selectedOpt.getAttribute('data-base')) || 20;
      if (catSelect && cat) catSelect.value = cat;
      if (priceInput) priceInput.value = (base * 1.4).toFixed(2);
    }
    this.updateListingProfitPreview();
  },

  updateListingProfitPreview() {
    const priceInput = document.getElementById('newCropPrice');
    const previewBox = document.getElementById('farmerProfitPreview');
    if (!priceInput || !previewBox) return;

    const rate = parseFloat(priceInput.value) || 25;
    const mandiRate = +(rate * 0.68).toFixed(2);
    const extraGain = +(rate - mandiRate).toFixed(2);

    previewBox.innerHTML = `
      <div style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 4px;">Dynamic Farmgate Realization Calculation:</div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #10b981; font-weight: 700;">Direct Price: ₹${rate.toFixed(2)}/unit</span>
        <span style="color: #ef4444; font-size: 0.8rem; text-decoration: line-through;">Traditional Mandi: ₹${mandiRate.toFixed(2)}</span>
      </div>
      <div style="font-size: 0.75rem; color: #f59e0b; margin-top: 4px;">
        Zero middleman cut: <strong>+₹${extraGain}/unit extra realization</strong> direct to your bank account!
      </div>
    `;
  }
};
