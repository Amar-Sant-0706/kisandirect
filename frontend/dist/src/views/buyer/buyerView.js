export const BuyerView = {
  async render(container, router) {
    const user = JSON.parse(localStorage.getItem('kd_user') || '{}');
    const token = localStorage.getItem('kd_token');
    let cart = [];
    let currentLots = [];

    container.innerHTML = `
      <!-- Buyer Portal Header -->
      <header class="portal-header">
        <div class="portal-brand" onclick="window.Router.navigate('/buyer/marketplace')">
          <div class="portal-brand-icon buyer">🛒</div>
          <div>
            <h2>KisanDirect <span>Verified Direct Farm Marketplace</span></h2>
          </div>
        </div>

        <div class="portal-actions">
          <button class="btn btn-outline" id="btnOpenOrdersModal" style="border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 700;">
            🚚 Live Fleet & GPS Telemetry (<span id="buyerOrdersCount">1</span>)
          </button>
          
          <button class="btn btn-primary-buyer" id="btnOpenCartModal">
            🛒 Farm Basket (<span id="cartCount">0</span>)
          </button>

          <div class="user-pill">
            <span class="user-pill-role buyer">BUYER</span>
            <span style="font-weight: 700; color: #fff;">${user.name || 'Vikram Mehta'}</span>
          </div>

          <button class="btn btn-outline" id="btnBuyerLogout" title="Sign Out">
            Logout
          </button>
        </div>
      </header>

      <!-- Main Marketplace Body -->
      <main class="portal-container">
        
        <!-- Marketplace Banner -->
        <div style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(16, 185, 129, 0.08)); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
          <div>
            <span style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.75rem; font-weight: 700; padding: 4px 12px; border-radius: 9999px; margin-bottom: 8px;">
              🛡️ Direct Farmgate Disintermediation • Zero Middlemen
            </span>
            <h1 style="font-size: 1.85rem; font-weight: 800; color: #fff; margin-bottom: 6px;">
              Procure Direct From Certified Growers & FPOs
            </h1>
            <p style="font-size: 0.9rem; color: #94a3b8; max-width: 700px;">
              Every listed harvest lot includes a tamper-proof SHA-256 neural grading certificate. Orders are protected by Platform Owner Double-Approval Escrow.
            </p>
          </div>

          <!-- Quality Filters -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-outline filter-btn active" data-grade="" style="font-size: 0.8rem; padding: 8px 14px;">All Produce</button>
            <button class="btn btn-outline filter-btn" data-grade="Grade A+" style="font-size: 0.8rem; padding: 8px 14px;">Grade A+</button>
            <button class="btn btn-outline filter-btn" data-grade="Grade A" style="font-size: 0.8rem; padding: 8px 14px;">Grade A</button>
            <button class="btn btn-outline filter-btn" data-grade="GlobalGAP" style="font-size: 0.8rem; padding: 8px 14px;">GlobalGAP</button>
          </div>
        </div>

        <!-- Produce Grid -->
        <div id="produceGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 1.5rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
            Loading verified harvest lots from national grid...
          </div>
        </div>
      </main>

      <!-- Cart & Bulk Checkout Modal -->
      <div class="modal-overlay" id="cartModal">
        <div class="modal-card" style="border-color: rgba(56, 189, 248, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              🛒 Direct Farm Produce Basket
            </h3>
            <button id="btnCloseCartModal" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div id="cartItemsContainer">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- QC Certificate Modal -->
      <div class="modal-overlay" id="qcModal">
        <div class="modal-card" style="border-color: rgba(16, 185, 129, 0.4); max-width: 540px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              🏅 Kisan-Vision AI Quality Certificate
            </h3>
            <button id="btnCloseQcModal" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div id="qcModalBody">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Orders & GPS Telemetry Modal -->
      <div class="modal-overlay" id="ordersModal">
        <div class="modal-card" style="max-width: 820px; border-color: rgba(56, 189, 248, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              🚚 Live Orders & Cold-Chain GPS Telemetry
            </h3>
            <button id="btnCloseOrdersModal" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <div id="ordersContainer">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
    `;

    // Logout
    document.getElementById('btnBuyerLogout')?.addEventListener('click', () => {
      localStorage.removeItem('kd_token');
      localStorage.removeItem('kd_user');
      router.navigate('/');
    });

    // Modal controls
    const cartModal = document.getElementById('cartModal');
    const ordersModal = document.getElementById('ordersModal');
    const qcModal = document.getElementById('qcModal');

    document.getElementById('btnOpenCartModal')?.addEventListener('click', () => {
      renderCart();
      cartModal?.classList.add('open');
    });
    document.getElementById('btnCloseCartModal')?.addEventListener('click', () => {
      cartModal?.classList.remove('open');
    });
    document.getElementById('btnOpenOrdersModal')?.addEventListener('click', () => {
      loadBuyerOrders();
      ordersModal?.classList.add('open');
    });
    document.getElementById('btnCloseOrdersModal')?.addEventListener('click', () => {
      ordersModal?.classList.remove('open');
    });
    document.getElementById('btnCloseQcModal')?.addEventListener('click', () => {
      qcModal?.classList.remove('open');
    });

    // Produce data loader
    async function loadProduce(gradeFilter = '') {
      const grid = document.getElementById('produceGrid');
      try {
        const url = gradeFilter ? `/api/marketplace/lots?grade=${encodeURIComponent(gradeFilter)}` : '/api/marketplace/lots';
        const res = await fetch(url);
        const data = await res.json();

        if (data.success) {
          currentLots = data.lots;
          if (data.lots.length === 0) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">No produce found for this filter.</div>';
            return;
          }

          grid.innerHTML = data.lots.map(lot => `
            <div class="card" style="padding: 0; overflow: hidden; border-color: rgba(255,255,255,0.08); transition: transform 0.2s ease;">
              <div style="height: 180px; position: relative; background: #0c1424;">
                <img src="${lot.image}" alt="${lot.crop_name}" style="width: 100%; height: 100%; object-fit: cover;" />
                <span class="badge badge-available" style="position: absolute; top: 12px; left: 12px; backdrop-filter: blur(8px);">
                  ${lot.qc_grade}
                </span>
                <span style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); color: #fff; font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-family: monospace;">
                  Batch #${lot.id}
                </span>
              </div>

              <div style="padding: 1.25rem;">
                <div style="font-size: 0.78rem; color: var(--buyer-accent); font-weight: 700; text-transform: uppercase;">
                  📍 ${lot.location}
                </div>
                <h3 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin: 4px 0 6px;">
                  ${lot.crop_name}
                </h3>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 12px;">
                  Grower: <strong style="color: #cbd5e1;">${lot.farmer_name}</strong> (${lot.fpo_name || 'Verified FPO'})
                </div>

                <div style="display: flex; justify-content: space-between; align-items: baseline; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; margin-bottom: 0.75rem;">
                  <div>
                    <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Direct Farm Price</span>
                    <strong style="color: #38bdf8; font-size: 1.3rem;">₹${lot.farmgate_price.toFixed(2)}</strong>
                    <span style="font-size: 0.75rem; color: var(--text-muted);">/kg</span>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Mandi Retail</span>
                    <span style="font-size: 0.85rem; color: #f43f5e; text-decoration: line-through;">₹${(lot.farmgate_price * 1.45).toFixed(2)}</span>
                  </div>
                </div>

                <!-- QC Certificate Button -->
                <button type="button" class="btn-view-qc" data-lot-id="${lot.id}" style="width: 100%; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; padding: 6px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
                  🔬 Inspect Kisan-Vision QC Certificate &rarr;
                </button>

                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-primary-buyer btn-add-cart" data-lot-id="${lot.id}" style="flex: 1; padding: 10px; font-size: 0.86rem; font-weight: 700;">
                    + Add to Basket
                  </button>
                </div>
              </div>
            </div>
          `).join('');

          // Bind cart buttons
          document.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const lotId = e.currentTarget.getAttribute('data-lot-id');
              const lot = currentLots.find(l => l.id === lotId);
              if (lot) addToCart(lot);
            });
          });

          // Bind QC Certificate view buttons
          document.querySelectorAll('.btn-view-qc').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const lotId = e.currentTarget.getAttribute('data-lot-id');
              const lot = currentLots.find(l => l.id === lotId);
              if (lot) showQcModal(lot);
            });
          });
        }
      } catch (err) {
        console.error('Error loading produce:', err);
      }
    }

    // QC Certificate Modal Handler
    function showQcModal(lot) {
      const modalBody = document.getElementById('qcModalBody');
      const freshness = lot.freshness_score || 97.4;
      const ripeness = lot.ripeness_score || 95.2;
      const blemish = lot.blemish_rate || 0.8;
      const diameter = lot.diameter_mm || 58.4;

      modalBody.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <div style="font-size: 0.8rem; color: #34d399; font-weight: 700; text-transform: uppercase;">
            🏛️ Government of India • DOCA Verified Certificate
          </div>
          <h4 style="font-size: 1.3rem; font-weight: 800; color: #fff; margin-top: 4px;">
            ${lot.crop_name}
          </h4>
          <span style="font-size: 0.82rem; color: var(--text-muted);">Batch #${lot.id} • Grower: ${lot.farmer_name}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1.25rem;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px;">
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Freshness Index</span>
            <strong style="color: #34d399; font-size: 1.2rem;">${freshness}%</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px;">
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Ripeness / Color Hue</span>
            <strong style="color: #38bdf8; font-size: 1.2rem;">${ripeness}%</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px;">
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Surface Defect Rate</span>
            <strong style="color: #a7f3d0; font-size: 1.2rem;">${blemish}%</strong>
          </div>
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px;">
            <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Calibrated Diameter</span>
            <strong style="color: #facc15; font-size: 1.2rem;">${diameter} mm</strong>
          </div>
        </div>

        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; margin-bottom: 1.25rem;">
          <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">
            Cryptographic SHA-256 Neural Certificate Hash:
          </span>
          <div style="font-family: monospace; font-size: 0.75rem; color: #34d399; word-break: break-all;">
            ${lot.qc_hash}
          </div>
        </div>

        <button type="button" class="btn btn-primary-farmer" onclick="document.getElementById('qcModal').classList.remove('open')" style="width: 100%; padding: 10px; font-weight: 700;">
          Close Certificate
        </button>
      `;

      qcModal?.classList.add('open');
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const grade = e.currentTarget.getAttribute('data-grade');
        loadProduce(grade);
      });
    });

    loadProduce();

    // ================================================================
    // CART & CHECKOUT LOGIC
    // ================================================================
    function addToCart(lot) {
      const existing = cart.find(item => item.id === lot.id);
      if (existing) {
        existing.quantity += 50;
      } else {
        cart.push({ ...lot, quantity: 100 });
      }
      updateCartBadge();
      alert(`Added ${lot.crop_name} to your direct procurement basket.`);
    }

    function updateCartBadge() {
      const badge = document.getElementById('cartCount');
      if (badge) badge.textContent = cart.reduce((acc, i) => acc + i.quantity, 0);
    }

    function renderCart() {
      const container = document.getElementById('cartItemsContainer');
      if (cart.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🧺</div>
            <p>Your procurement basket is empty.</p>
          </div>
        `;
        return;
      }

      const total = cart.reduce((acc, i) => acc + (i.farmgate_price * i.quantity), 0);

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 1.5rem;">
          ${cart.map((item, idx) => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
              <div>
                <strong style="color: #fff; display: block;">${item.crop_name}</strong>
                <span style="font-size: 0.8rem; color: var(--text-muted);">₹${item.farmgate_price}/kg • Lot #${item.id}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <input type="number" min="10" step="10" value="${item.quantity}" data-idx="${idx}" class="cart-qty-input" style="width: 80px; padding: 6px; border-radius: 6px; background: #0c1424; border: 1px solid var(--border-subtle); color: #fff; text-align: center;" />
                <span style="font-weight: 700; color: #38bdf8;">₹${(item.farmgate_price * item.quantity).toFixed(2)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background: rgba(56, 189, 248, 0.08); border: 1px dashed #38bdf8; border-radius: 8px; padding: 12px; margin-bottom: 1.5rem; font-size: 0.82rem; color: #94a3b8;">
          <strong style="color: #38bdf8;">Double-Approval Escrow Disclaimer:</strong>
          Placing this order locks payment in the DOCA Escrow Smart Vault with status <code>PENDING_OWNER_VERIFICATION</code>. Once the Platform Owner validates farmer lot authenticity, cold-chain reefer dispatch is scheduled.
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; font-size: 1.15rem; font-weight: 800; color: #fff;">
          <span>Escrow Total:</span>
          <span style="color: #38bdf8;">₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label class="form-label">Delivery Destination / Cold Staging Depot</label>
          <input type="text" id="deliveryAddressInput" class="form-control" value="Reliance Fresh Distribution Hub, Sector 19 Vashi APMC, Navi Mumbai" required />
        </div>

        <button type="button" class="btn btn-primary-buyer" id="btnPlaceEscrowOrder" style="width: 100%; padding: 12px; font-weight: 800;">
          🔒 Lock Escrow & Submit Order for Owner Verification &rarr;
        </button>
      `;

      // Update qty
      document.querySelectorAll('.cart-qty-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
          const newQty = parseFloat(e.currentTarget.value) || 10;
          cart[idx].quantity = newQty;
          renderCart();
          updateCartBadge();
        });
      });

      // Checkout handler
      document.getElementById('btnPlaceEscrowOrder')?.addEventListener('click', async () => {
        const address = document.getElementById('deliveryAddressInput')?.value;
        if (!token) {
          alert('Session expired. Please log in as Buyer.');
          router.navigate('/auth/login?role=buyer');
          return;
        }

        try {
          for (const item of cart) {
            await fetch('/api/orders/checkout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                crop_lot_id: item.id,
                quantity: item.quantity,
                delivery_address: address
              })
            });
          }

          alert('Order submitted successfully! Escrow locked under PENDING_OWNER verification.');
          cart = [];
          updateCartBadge();
          cartModal?.classList.remove('open');
          loadBuyerOrders();
        } catch (err) {
          alert('Network error while placing order.');
        }
      });
    }

    // ================================================================
    // ORDERS & GPS TELEMETRY
    // ================================================================
    async function loadBuyerOrders() {
      const container = document.getElementById('ordersContainer');
      const countEl = document.getElementById('buyerOrdersCount');

      try {
        const res = await fetch('/api/buyer/orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
          if (countEl) countEl.textContent = data.orders.length;

          if (data.orders.length === 0) {
            container.innerHTML = `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                <p>No procurement orders placed yet.</p>
              </div>
            `;
            return;
          }

          container.innerHTML = data.orders.map(o => `
            <div class="card" style="background: #0d1527; border-color: rgba(56, 189, 248, 0.25); margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px; margin-bottom: 12px;">
                <div>
                  <strong style="color: #fff; font-size: 1.1rem;">Order #${o.order_number}</strong>
                  <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">${o.crop_name} (${o.quantity} kg)</span>
                </div>
                <span class="badge badge-${o.status === 'approved' ? 'available' : o.status === 'rejected' ? 'rejected' : 'pending'}">
                  ${o.status.toUpperCase()}
                </span>
              </div>

              <!-- Telemetry corridor widget -->
              <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="font-size: 0.78rem; color: #38bdf8; font-weight: 700; text-transform: uppercase;">
                    🛰️ AI Cold-Chain Reefer Telemetry
                  </span>
                  <span style="font-size: 0.82rem; color: #34d399; font-weight: 700;">
                    ${o.telemetry ? o.telemetry.status_label : 'In Transit'}
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 0.82rem;">
                  <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block;">Reefer Cargo Temp</span>
                    <strong style="color: #38bdf8; font-size: 1.15rem;">${o.telemetry ? o.telemetry.temperature_c : '4.2'}°C</strong>
                  </div>
                  <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block;">Relative Humidity</span>
                    <strong style="color: #34d399; font-size: 1.15rem;">${o.telemetry ? o.telemetry.humidity_rh : '88'}% RH</strong>
                  </div>
                  <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block;">Fleet Speed</span>
                    <strong style="color: #fbbf24; font-size: 1.15rem;">${o.telemetry ? o.telemetry.speed_kmh : '58'} km/h</strong>
                  </div>
                  <div style="background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px;">
                    <span style="color: var(--text-muted); font-size: 0.72rem; display: block;">Escrow Held</span>
                    <strong style="color: #fff; font-size: 1.15rem;">₹${o.total_amount.toFixed(2)}</strong>
                  </div>
                </div>

                <div style="margin-top: 10px; font-size: 0.78rem; color: #94a3b8;">
                  📍 Corridor: <strong>Western Agri-Express (Nashik ➔ Mumbai Vashi APMC)</strong>
                </div>
              </div>
            </div>
          `).join('');
        }
      } catch (err) {
        console.error('Error loading buyer orders:', err);
      }
    }

    loadBuyerOrders();
  }
};
