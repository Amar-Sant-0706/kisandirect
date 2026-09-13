export const OwnerView = {
  async render(container, router) {
    const user = JSON.parse(localStorage.getItem('kd_user') || '{}');
    const token = localStorage.getItem('kd_token');

    container.innerHTML = `
      <!-- Owner Control Room Header -->
      <header class="portal-header" style="border-bottom-color: rgba(192, 132, 252, 0.25);">
        <div class="portal-brand" onclick="window.Router.navigate('/owner/control-room')">
          <div class="portal-brand-icon owner">🛡️</div>
          <div>
            <h2>DOCA Master Control Room <span>Ministry of Consumer Affairs & Public Distribution</span></h2>
          </div>
        </div>

        <div class="portal-actions">
          <div class="user-pill" style="border-color: rgba(192, 132, 252, 0.4);">
            <span class="user-pill-role owner">PLATFORM OWNER</span>
            <span style="font-weight: 700; color: #fff;">${user.name || 'DOCA Master Regulator'}</span>
          </div>

          <button class="btn btn-outline" id="btnOwnerLogout" title="Sign Out">
            Logout
          </button>
        </div>
      </header>

      <!-- Main Control Room Body -->
      <main class="portal-container">
        
        <!-- Live System Metric HUD -->
        <div class="stats-grid">
          <div class="stat-box owner">
            <span class="stat-label">Pending Verification Queue</span>
            <span class="stat-value" id="hudPendingCount" style="color: #fbbf24;">1</span>
            <span class="stat-meta" style="color: #fbbf24;">Requires Double-Approval Review</span>
          </div>

          <div class="stat-box owner">
            <span class="stat-label">Registered Participants</span>
            <span class="stat-value" id="hudUsersCount">3</span>
            <span class="stat-meta" style="color: #c084fc;">Farmers & Institutional Buyers</span>
          </div>

          <div class="stat-box owner">
            <span class="stat-label">Unorganized Margin Slashed</span>
            <span class="stat-value" style="color: #34d399;" id="hudMarginSlashed">₹ 18.4L</span>
            <span class="stat-meta" style="color: #34d399;">Middlemen Markups Eliminated</span>
          </div>

          <div class="stat-box owner">
            <span class="stat-label">Cold-Chain Fleet Grid</span>
            <span class="stat-value" id="hudReefersCount">12 Reefers</span>
            <span class="stat-meta" style="color: #38bdf8;">Active Telemetry Corridor (VRP)</span>
          </div>
        </div>

        <!-- ================================================================
             MODULE 1: DOUBLE-APPROVAL VERIFICATION QUEUE
             ================================================================ -->
        <div class="card" style="margin-bottom: 2rem; border-color: rgba(192, 132, 252, 0.35);">
          <div class="card-header">
            <div>
              <h3 class="card-title" style="color: #c084fc;">
                🛡️ Double-Approval Escrow Verification Queue
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                Validate grower authenticity, tamper-proof QC hash, and buyer business license before releasing escrow and triggering cold-chain dispatch.
              </p>
            </div>
            <span class="badge badge-pending" id="badgePendingCount">1 Pending</span>
          </div>

          <div id="pendingQueueContainer">
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
              Loading verification queue...
            </div>
          </div>
        </div>

        <!-- ================================================================
             MODULE 2: AI ROUTE FLEET OPTIMIZER (VRP - VEHICLE ROUTING PROBLEM)
             ================================================================ -->
        <div class="card" style="margin-bottom: 2rem; border-color: rgba(56, 189, 248, 0.35); background: linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.9) 100%);">
          <div class="card-header">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 9999px; margin-bottom: 6px;">
                🚚 AI FLEET ROUTING & LOGISTICS ENGINE (VRP)
              </div>
              <h3 class="card-title" style="color: #fff;">
                National Cold-Chain Corridor Fleet Optimizer
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;" id="vrpCorridorName">
                Western Agri-Express Corridor (Nashik Farmgate ➔ Mumbai Vashi APMC)
              </p>
            </div>
            <span class="badge badge-available">VRP Active (12 Reefers)</span>
          </div>

          <!-- Fleet KPI Strip -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 1rem 0;">
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Distance Saved</span>
              <strong style="color: #38bdf8; font-size: 1.25rem;" id="vrpDistSaved">42.4 km (25.2%)</strong>
            </div>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Transit Time Saved</span>
              <strong style="color: #34d399; font-size: 1.25rem;" id="vrpTimeSaved">3.2 Hours</strong>
            </div>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Fuel Cost Slashed</span>
              <strong style="color: #fbbf24; font-size: 1.25rem;" id="vrpFuelSaved">₹ 2,840</strong>
            </div>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); padding: 12px; border-radius: 8px;">
              <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">Carbon Offset</span>
              <strong style="color: #34d399; font-size: 1.25rem;" id="vrpCarbonOffset">124.5 kg CO2</strong>
            </div>
          </div>

          <!-- Waypoints Timeline -->
          <div style="margin-top: 1.25rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: #fff; margin-bottom: 12px;">
              Corridor Waypoint Scheduling & Telemetry Logs:
            </h4>
            <div class="waypoint-timeline" id="vrpWaypointsContainer">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>

        <!-- ================================================================
             MODULE 3: AI MARKET SURVEILLANCE & PRICE VOLATILITY ENGINE
             ================================================================ -->
        <div class="card" style="margin-bottom: 2rem; border-color: rgba(245, 158, 11, 0.35);">
          <div class="card-header">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 9999px; margin-bottom: 6px;">
                📊 MARKET SURVEILLANCE & EARLY GLUT DETECTION
              </div>
              <h3 class="card-title" style="color: #fff;">
                Mandi APMC vs. KisanDirect Price Volatility Radar
              </h3>
            </div>
            <span class="badge badge-pending" id="surveillanceGlutBadge">Glut Risk: 74%</span>
          </div>

          <!-- Early Glut Warning Banner -->
          <div style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 8px; padding: 12px 16px; margin: 1rem 0; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div>
              <strong style="color: #fda4af; font-size: 0.95rem;">⚠️ Early Harvest Glut Alert: Nashik Red Onion (Kharif)</strong>
              <div style="font-size: 0.82rem; color: #cbd5e1; margin-top: 2px;">
                Glut Probability: <strong>74% in next 14 days</strong>. Recommended buffer action: <strong>Allocate 3,500 MT to cold storage buffer to prevent crash.</strong>
              </div>
            </div>
            <span class="badge badge-rejected" style="font-weight: 800;">HIGH REGULATORY ALERT</span>
          </div>

          <!-- Spreads Table -->
          <div class="table-container" style="margin-top: 1rem;">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Commodity</th>
                  <th>KisanDirect Farmgate</th>
                  <th>APMC Mandi Price</th>
                  <th>Farmer Spread Advantage</th>
                  <th>Volume Traded</th>
                  <th>Market Volatility</th>
                </tr>
              </thead>
              <tbody id="surveillanceTableBody">
                <!-- Rendered dynamically -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- ================================================================
             MODULE 4: USER MODERATION & PROFILE DISMISSAL DECK
             ================================================================ -->
        <div class="card" style="margin-bottom: 2rem;">
          <div class="card-header">
            <div>
              <h3 class="card-title" style="color: #f43f5e;">
                👥 Participant Moderation Deck & Instant Profile Dismissal
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                One-click action to ban fraudulent buyers or sellers. Revokes JWT session immediately and wipes active listings/pending bids.
              </p>
            </div>
          </div>

          <div class="table-container">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Role</th>
                  <th>Location / Business Hub</th>
                  <th>Status</th>
                  <th style="text-align: right;">Moderation Action</th>
                </tr>
              </thead>
              <tbody id="userModerationTbody">
                <tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading participants...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ================================================================
             MODULE 5: LIVE SYSTEM ACTIVITY FEED
             ================================================================ -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="color: #38bdf8;">
              📡 Live Activity Feed & Audit Trail
            </h3>
            <span style="font-size: 0.78rem; color: var(--text-muted);">Chronological Log of Farmer Listings, Buyer Bids, and Escrow Transitions</span>
          </div>

          <div id="activityFeedContainer" style="display: flex; flex-direction: column; gap: 10px;">
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
              Loading live activity timeline...
            </div>
          </div>
        </div>

      </main>
    `;

    // Logout
    document.getElementById('btnOwnerLogout')?.addEventListener('click', () => {
      localStorage.removeItem('kd_token');
      localStorage.removeItem('kd_user');
      router.navigate('/');
    });

    // ================================================================
    // LOAD PENDING TRANSACTIONS (DOUBLE-APPROVAL QUEUE)
    // ================================================================
    async function loadPendingTransactions() {
      const container = document.getElementById('pendingQueueContainer');
      const badge = document.getElementById('badgePendingCount');
      const hud = document.getElementById('hudPendingCount');

      try {
        const res = await fetch('/api/owner/pending-orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
          if (badge) badge.textContent = `${data.transactions.length} Pending`;
          if (hud) hud.textContent = data.transactions.length;

          if (data.transactions.length === 0) {
            container.innerHTML = `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
                <div style="font-size: 2.5rem; margin-bottom: 8px;">✓</div>
                <h4 style="color: #fff;">Queue Clean • Zero Pending Deals</h4>
                <p style="font-size: 0.85rem; margin-top: 4px;">All placed crop orders have completed Double-Approval Escrow verification.</p>
              </div>
            `;
            return;
          }

          container.innerHTML = data.transactions.map(t => `
            <div class="card" style="background: #0d1527; border-color: rgba(192, 132, 252, 0.25); margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 10px; margin-bottom: 12px;">
                <div>
                  <strong style="color: #fff; font-size: 1.05rem;">Transaction #${t.order_number}</strong>
                  <span style="font-size: 0.78rem; color: #fbbf24; margin-left: 10px;">• ESCROW HELD: ₹${t.total_amount.toLocaleString('en-IN')}</span>
                </div>
                <span class="badge badge-pending">PENDING OWNER DOUBLE-APPROVAL</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                <!-- Farmer Profile Card -->
                <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px;">
                  <div style="font-size: 0.72rem; color: #34d399; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">🌾 Verified Grower Profile</div>
                  <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${t.farmer_name}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">${t.farmer_location} • ${t.farmer_email}</div>
                  <div style="margin-top: 8px;">
                    <span class="badge badge-available">${t.qc_grade}</span>
                    <span style="font-family: monospace; font-size: 0.72rem; color: #a7f3d0; margin-left: 6px;">${t.qc_hash.slice(0, 18)}...</span>
                  </div>
                </div>

                <!-- Buyer Profile Card -->
                <div style="background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 12px;">
                  <div style="font-size: 0.72rem; color: #38bdf8; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">🛒 Institutional Buyer Profile</div>
                  <div style="font-weight: 700; color: #fff; font-size: 0.95rem;">${t.buyer_name}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">${t.buyer_business || 'Commercial Buyer'} • ${t.buyer_email}</div>
                  <div style="margin-top: 8px; font-size: 0.78rem; color: #94a3b8;">
                    Destination: <strong style="color: #e2e8f0;">${t.delivery_address}</strong>
                  </div>
                </div>
              </div>

              <!-- Action Bar -->
              <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
                <button class="btn btn-outline btn-reject-tx" data-id="${t.id}" style="border-color: #f43f5e; color: #f43f5e; font-size: 0.85rem; padding: 8px 16px;">
                  ✕ Dismiss & Refund Escrow
                </button>
                <button class="btn btn-primary-farmer btn-approve-tx" data-id="${t.id}" style="font-size: 0.85rem; padding: 8px 20px; font-weight: 800;">
                  ✓ Approve Transaction & Dispatch Reefer
                </button>
              </div>
            </div>
          `).join('');

          // Bind approve & reject buttons
          document.querySelectorAll('.btn-approve-tx').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const orderId = e.currentTarget.getAttribute('data-id');
              await handleTxAction(orderId, 'APPROVE');
            });
          });

          document.querySelectorAll('.btn-reject-tx').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const orderId = e.currentTarget.getAttribute('data-id');
              const reason = prompt('Specify regulatory reason for rejecting escrow transaction:');
              if (reason) {
                await handleTxAction(orderId, 'REJECT', reason);
              }
            });
          });
        }
      } catch (err) {
        console.error('Error loading pending tx:', err);
      }
    }

    async function handleTxAction(orderId, action, reason) {
      try {
        const res = await fetch(`/api/owner/orders/${orderId}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ action, reason })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Transaction successfully processed (${action})!`);
          loadPendingTransactions();
          loadLiveFeed();
        } else {
          alert('Error: ' + (data.message || data.error));
        }
      } catch (err) {
        alert('Network error while processing transaction.');
      }
    }

    // ================================================================
    // LOAD AI FLEET OPTIMIZER (VRP)
    // ================================================================
    async function loadFleetOptimizer() {
      try {
        const res = await fetch('/api/owner/fleet-optimizer', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.fleet) {
          const fl = data.fleet;
          const distSaved = document.getElementById('vrpDistSaved');
          const timeSaved = document.getElementById('vrpTimeSaved');
          const fuelSaved = document.getElementById('vrpFuelSaved');
          const carbonOffset = document.getElementById('vrpCarbonOffset');
          const wpContainer = document.getElementById('vrpWaypointsContainer');

          if (distSaved) distSaved.textContent = `${fl.distanceSavedKm} km (${fl.distanceSavedPercent})`;
          if (timeSaved) timeSaved.textContent = `${fl.transitTimeSavedHours} Hours`;
          if (fuelSaved) fuelSaved.textContent = `₹ ${fl.fuelCostSavedInr.toLocaleString('en-IN')}`;
          if (carbonOffset) carbonOffset.textContent = `${fl.carbonOffsetKg} kg CO2`;

          if (wpContainer && fl.waypoints) {
            wpContainer.innerHTML = fl.waypoints.map(w => `
              <div class="waypoint-item">
                <div class="waypoint-node ${w.current ? 'active' : ''}"></div>
                <div style="font-size: 0.88rem; font-weight: 700; color: #fff;">
                  ${w.name}
                  <span style="font-size: 0.75rem; color: ${w.current ? '#38bdf8' : w.completed ? '#34d399' : '#94a3b8'}; margin-left: 8px;">
                    [${w.status} • ${w.time}]
                  </span>
                </div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  Reefer: ${w.reeferId || 'Active Fleet'} • Temp: <strong style="color: #38bdf8;">${w.temp || w.targetTemp}</strong> ${w.humidity ? `• Humidity: ${w.humidity}` : ''}
                </div>
              </div>
            `).join('');
          }
        }
      } catch (err) {
        console.error('Error loading fleet optimizer:', err);
      }
    }

    // ================================================================
    // LOAD AI MARKET SURVEILLANCE & PRICE SPREADS
    // ================================================================
    async function loadMarketSurveillance() {
      try {
        const res = await fetch('/api/owner/market-surveillance', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && data.surveillance) {
          const sv = data.surveillance;
          const tbody = document.getElementById('surveillanceTableBody');
          const hudMargin = document.getElementById('hudMarginSlashed');

          if (hudMargin) hudMargin.textContent = `₹ ${(sv.unorganizedMarginEliminatedTotal / 100000).toFixed(1)}L`;

          if (tbody && sv.priceSpreads) {
            tbody.innerHTML = sv.priceSpreads.map(p => `
              <tr>
                <td><strong style="color: #fff;">${p.commodity}</strong></td>
                <td><strong style="color: #34d399; font-size: 1rem;">₹${p.kisanDirectPrice.toFixed(2)}/kg</strong></td>
                <td><span style="color: var(--text-muted); text-decoration: line-through;">₹${p.apmcMandiPrice.toFixed(2)}/kg</span></td>
                <td>
                  <span style="color: #38bdf8; font-weight: 800;">+₹${p.marginSlashed.toFixed(2)}/kg (${p.spreadPercent})</span>
                </td>
                <td><span style="color: #e2e8f0;">${p.volumeTradedKg.toLocaleString('en-IN')} kg</span></td>
                <td>
                  <span class="badge badge-${p.volatility === 'Low' ? 'available' : p.volatility === 'Moderate' ? 'pending' : 'rejected'}">
                    ${p.volatility.toUpperCase()}
                  </span>
                </td>
              </tr>
            `).join('');
          }
        }
      } catch (err) {
        console.error('Error loading market surveillance:', err);
      }
    }

    // ================================================================
    // LOAD USERS FOR MODERATION
    // ================================================================
    async function loadUsers() {
      const tbody = document.getElementById('userModerationTbody');
      const hudCount = document.getElementById('hudUsersCount');

      try {
        const res = await fetch('/api/owner/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
          if (hudCount) hudCount.textContent = data.users.length;

          if (tbody) {
            tbody.innerHTML = data.users.map(u => `
              <tr>
                <td>
                  <div style="font-weight: 700; color: #fff;">${u.name}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${u.email}</div>
                </td>
                <td>
                  <span class="user-pill-role ${u.role}">${u.role.toUpperCase()}</span>
                </td>
                <td>${u.location || 'Maharashtra, India'}</td>
                <td>
                  <span class="badge badge-${u.is_banned === 1 ? 'rejected' : 'available'}">
                    ${u.is_banned === 1 ? 'DISMISSED / BANNED' : 'ACTIVE PARTICIPANT'}
                  </span>
                </td>
                <td style="text-align: right;">
                  ${u.is_banned === 1 ? `
                    <span style="font-size: 0.78rem; color: #f43f5e; font-weight: 700;">Account Blacklisted</span>
                  ` : `
                    <button class="btn btn-outline btn-dismiss-user" data-id="${u.id}" data-name="${u.name}" style="border-color: #f43f5e; color: #f43f5e; font-size: 0.78rem; padding: 6px 12px;">
                      Dismiss Profile &times;
                    </button>
                  `}
                </td>
              </tr>
            `).join('');

            // Bind dismiss buttons
            document.querySelectorAll('.btn-dismiss-user').forEach(btn => {
              btn.addEventListener('click', async (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                const userName = e.currentTarget.getAttribute('data-name');
                const reason = prompt(`Specify regulatory reason to permanently dismiss and ban "${userName}":`);
                if (reason) {
                  try {
                    const resB = await fetch(`/api/owner/users/${userId}/dismiss`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ reason })
                    });
                    const d = await resB.json();
                    if (d.success) {
                      alert(`User profile ${userName} dismissed and listings purged.`);
                      loadUsers();
                      loadLiveFeed();
                    } else {
                      alert('Error: ' + (d.message || d.error));
                    }
                  } catch (err) {
                    alert('Network error while dismissing user.');
                  }
                }
              });
            });
          }
        }
      } catch (err) {
        console.error('Error loading users:', err);
      }
    }

    // ================================================================
    // LOAD LIVE ACTIVITY FEED
    // ================================================================
    async function loadLiveFeed() {
      const container = document.getElementById('activityFeedContainer');
      try {
        const res = await fetch('/api/owner/live-feed', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success && container) {
          if (data.feed.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 1.5rem;">No recent activities logged.</div>';
            return;
          }

          container.innerHTML = data.feed.slice(0, 15).map(f => {
            const timeStr = new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: 8px; border-left: 3px solid ${f.role === 'farmer' ? '#10b981' : f.role === 'buyer' ? '#38bdf8' : '#c084fc'};">
                <div>
                  <strong style="color: #fff; font-size: 0.85rem;">${f.actor_name}</strong>
                  <span class="badge badge-pending" style="font-size: 0.68rem; margin: 0 6px;">${f.action}</span>
                  <span style="font-size: 0.82rem; color: #cbd5e1;">${f.details}</span>
                </div>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${timeStr}</span>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        console.error('Error loading live feed:', err);
      }
    }

    // Initial loads
    loadPendingTransactions();
    loadFleetOptimizer();
    loadMarketSurveillance();
    loadUsers();
    loadLiveFeed();
  }
};
