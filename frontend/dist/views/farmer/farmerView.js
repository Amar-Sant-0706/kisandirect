import { KisanVaniVoice } from '../../components/kisanVaniVoice.js';

export const FarmerView = {
  async render(container, router) {
    const user = JSON.parse(localStorage.getItem('kd_user') || '{}');
    const token = localStorage.getItem('kd_token');

    // State for Kisan-Vision AI scanner
    let scannedResult = null;
    let selectedCropPreset = 'Tomato';

    container.innerHTML = `
      <!-- Farmer Portal Header -->
      <header class="portal-header">
        <div class="portal-brand" onclick="window.Router.navigate('/farmer/dashboard')">
          <div class="portal-brand-icon farmer">🌾</div>
          <div>
            <h2>KisanDirect <span>Grower & FPO Producer Portal</span></h2>
          </div>
        </div>

        <div class="portal-actions">
          <button class="btn btn-outline" id="btnHeaderVoice" style="border-color: #34d399; color: #34d399; font-weight: 700;">
            🎙️ Kisan Vani Voice
          </button>
          <a href="#kisanVisionSection" class="btn btn-outline" style="border-color: #10b981; color: #10b981; font-weight: 700;">
            🤖 AI Quality Scanner
          </a>
          <button class="btn btn-primary-farmer" id="btnOpenNewCropModal">
            + List Harvest Batch
          </button>
          <div class="user-pill">
            <span class="user-pill-role farmer">FARMER</span>
            <span style="font-weight: 700; color: #fff;">${user.name || 'Ramesh Patil'}</span>
          </div>
          <button class="btn btn-outline" id="btnFarmerLogout" title="Sign Out">
            Logout
          </button>
        </div>
      </header>

      <!-- Main Portal Body -->
      <main class="portal-container">
        
        <!-- Live Farmer Metrics Grid -->
        <div class="stats-grid">
          <div class="stat-box farmer">
            <span class="stat-label">Active Batches Listed</span>
            <span class="stat-value" id="farmerActiveLots">3 Lots</span>
            <span class="stat-meta" style="color: #34d399;">Grade A+ Certified on Grid</span>
          </div>
          <div class="stat-box farmer">
            <span class="stat-label">Direct Realized Payouts</span>
            <span class="stat-value" id="farmerTotalEarnings">₹ 4,82,500</span>
            <span class="stat-meta" style="color: #34d399;">100% Escrow Settled via T+1</span>
          </div>
          <div class="stat-box farmer">
            <span class="stat-label">Cold-Chain Reefer Pickups</span>
            <span class="stat-value">3 Trucks</span>
            <span class="stat-meta" style="color: #fbbf24;">Next Pickup Scheduled 08:30 AM</span>
          </div>
          <div class="stat-box farmer">
            <span class="stat-label">Average Realization Premium</span>
            <span class="stat-value">+32%</span>
            <span class="stat-meta" style="color: #34d399;">Direct over APMC Mandi Cartels</span>
          </div>
        </div>

        <!-- ================================================================
             MODULE 1: AI DEMAND & PRICE ADVISORY (FARMER EDITION)
             ================================================================ -->
        <div class="card" style="margin-bottom: 2rem; border-color: rgba(16, 185, 129, 0.35); background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%);">
          <div class="card-header">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 9999px; margin-bottom: 6px;">
                📈 AI DEMAND & HARVEST-HOLD ADVISORY
              </div>
              <h3 class="card-title" style="color: #fff;">
                National Farmgate Predictive Price & Buffer Advisory
              </h3>
            </div>
            <span class="badge badge-available" id="advisoryBadge">AI Active</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
            <!-- Recommendation Box -->
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 1.25rem;">
              <div style="font-size: 0.75rem; color: #34d399; font-weight: 700; text-transform: uppercase;">
                💡 Smart Storage Recommendation
              </div>
              <h4 style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 6px 0 8px;" id="advHeadline">
                Hold 40% stock in cold storage for +18% realization in 12-14 days
              </h4>
              <p style="font-size: 0.84rem; color: #94a3b8; line-height: 1.5;" id="advStrategy">
                Staggered Dispatch: Sell 60% immediately at farmgate; store 40% in DOCA subsidized cold-chain hubs to capture Navratri festival price spikes.
              </p>
              <div style="display: flex; justify-content: space-between; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.8rem;">
                <span style="color: #94a3b8;">Est. Net Gain:</span>
                <strong style="color: #34d399;" id="advNetGain">+₹3.65 / kg</strong>
              </div>
            </div>

            <!-- Festive Surge Alert -->
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 1.25rem;">
              <div style="font-size: 0.75rem; color: #fbbf24; font-weight: 700; text-transform: uppercase;">
                🔥 Festive Demand Spike Radar
              </div>
              <h4 style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 6px 0 8px;" id="advEvent">
                Navratri & Diwali Festive Procurement Surge
              </h4>
              <p style="font-size: 0.84rem; color: #94a3b8; line-height: 1.5;">
                Buyer inquiries from Mumbai, Pune, and Surat institutional chains increased <strong style="color: #fbbf24;" id="advDemandIndex">+28.4%</strong> this week for direct farmgate procurement.
              </p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;" id="advSurgeBadges">
                <span class="badge badge-pending">🧅 Onion (+34% Demand)</span>
                <span class="badge badge-pending">🍅 Tomato (+26% Demand)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ================================================================
             MODULE 2: AI QUALITY SCANNER ("KISAN-VISION")
             ================================================================ -->
        <div class="card" id="kisanVisionSection" style="margin-bottom: 2rem; border-color: rgba(16, 185, 129, 0.45);">
          <div class="card-header">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.18); color: #34d399; font-size: 0.75rem; font-weight: 800; padding: 4px 10px; border-radius: 9999px; margin-bottom: 6px;">
                🔬 COMPUTER VISION & CRYPTOGRAPHIC QC
              </div>
              <h3 class="card-title" style="color: #fff;">
                "Kisan-Vision" AI Crop Quality & Defect Scanner
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">
                Analyze crop ripeness, surface defects, diameter, and freshness. Automatically computes a tamper-proof SHA-256 QC Hash.
              </p>
            </div>
          </div>

          <!-- Scanner Layout -->
          <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 1.5rem; margin-top: 1rem; align-items: start;">
            
            <!-- Left: Image View & Crop Presets -->
            <div>
              <div style="font-size: 0.82rem; color: #94a3b8; font-weight: 600; margin-bottom: 8px;">
                Select Sample Crop or Upload Harvest Photo:
              </div>

              <!-- Preset buttons -->
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
                <button type="button" class="btn btn-outline crop-preset-btn active" data-crop="Tomato" style="font-size: 0.8rem; padding: 6px 12px; border-color: #10b981;">
                  🍅 Solapur Tomato
                </button>
                <button type="button" class="btn btn-outline crop-preset-btn" data-crop="Onion" style="font-size: 0.8rem; padding: 6px 12px;">
                  🧅 Nashik Onion
                </button>
                <button type="button" class="btn btn-outline crop-preset-btn" data-crop="Potato" style="font-size: 0.8rem; padding: 6px 12px;">
                  🥔 Agra Potato
                </button>
                <button type="button" class="btn btn-outline crop-preset-btn" data-crop="Apple" style="font-size: 0.8rem; padding: 6px 12px;">
                  🍎 Kinnaur Apple
                </button>
              </div>

              <!-- Scanner Canvas Box -->
              <div class="ai-scanner-box" style="height: 250px; position: relative;">
                <img id="scanImagePreview" src="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80" alt="Harvest Produce" style="width: 100%; height: 100%; object-fit: cover;" />
                
                <!-- Laser line & reticles overlay (visible when scanning) -->
                <div class="ai-scan-laser" id="scanLaser" style="display: none;"></div>
                <div class="ai-reticle" id="scanReticle" style="top: 25%; left: 30%; width: 40%; height: 45%; display: none;"></div>
                <div class="ai-scan-overlay"></div>

                <div style="position: absolute; bottom: 10px; left: 10px; right: 10px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.65); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; color: #fff;">
                  <span id="scanStatusText">Camera / Feed Ready</span>
                  <span style="font-family: monospace; color: #34d399;">Model: KV-Neural-v3.4</span>
                </div>
              </div>

              <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button type="button" class="btn btn-primary-farmer" id="btnRunScan" style="flex: 1; padding: 12px; font-weight: 800;">
                  🔍 Run Kisan-Vision AI Scan
                </button>
                <label class="btn btn-outline" style="cursor: pointer; padding: 12px; font-size: 0.82rem;">
                  📁 Upload Photo
                  <input type="file" id="cropFileInput" accept="image/*" style="display: none;" />
                </label>
              </div>
            </div>

            <!-- Right: AI Metric Analysis Results -->
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;">
                <h4 style="font-size: 1.05rem; font-weight: 800; color: #fff;">
                  Real-Time Computer Vision Diagnostics
                </h4>
                <span class="badge badge-available" id="scanGradeBadge">Grade A+ (Certified)</span>
              </div>

              <!-- Metric Grid -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 1rem;">
                <div class="metric-pill-gauge">
                  <span class="metric-title">Freshness Index</span>
                  <span class="metric-value" style="color: #34d399;" id="valFreshness">97.4%</span>
                  <div class="metric-bar-bg"><div class="metric-bar-fill" id="barFreshness" style="width: 97%; background: #34d399;"></div></div>
                </div>

                <div class="metric-pill-gauge">
                  <span class="metric-title">Ripeness / Color Hue</span>
                  <span class="metric-value" style="color: #38bdf8;" id="valRipeness">95.2%</span>
                  <div class="metric-bar-bg"><div class="metric-bar-fill" id="barRipeness" style="width: 95%; background: #38bdf8;"></div></div>
                </div>

                <div class="metric-pill-gauge">
                  <span class="metric-title">Surface Blemish Rate</span>
                  <span class="metric-value" style="color: #a7f3d0;" id="valBlemish">0.8%</span>
                  <div class="metric-bar-bg"><div class="metric-bar-fill" id="barBlemish" style="width: 8%; background: #10b981;"></div></div>
                </div>

                <div class="metric-pill-gauge">
                  <span class="metric-title">Calibrated Diameter</span>
                  <span class="metric-value" style="color: #facc15;" id="valDiameter">58.4 mm</span>
                  <div class="metric-bar-bg"><div class="metric-bar-fill" id="barDiameter" style="width: 75%; background: #facc15;"></div></div>
                </div>
              </div>

              <!-- Fair Price Recommendation -->
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px dashed rgba(16, 185, 129, 0.4); border-radius: 8px; padding: 10px 14px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-size: 0.72rem; color: #34d399; font-weight: 700; text-transform: uppercase;">AI Fair Price Delta</span>
                  <div style="font-size: 0.88rem; color: #fff; font-weight: 700;" id="valPriceDelta">+₹8.00/kg (+57% over Mandi)</div>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 0.72rem; color: var(--text-muted);">Recommended Farmgate</span>
                  <div style="font-size: 1.25rem; font-weight: 800; color: #34d399;" id="valRecPrice">₹22.00/kg</div>
                </div>
              </div>

              <!-- Cryptographic Hash Display -->
              <div style="margin-bottom: 1.25rem;">
                <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">
                  Tamper-Proof SHA-256 QC Hash:
                </span>
                <div style="font-family: monospace; font-size: 0.75rem; color: #a7f3d0; background: rgba(0,0,0,0.4); padding: 6px 10px; border-radius: 6px; word-break: break-all; border: 1px solid rgba(255,255,255,0.06);" id="valQcHash">
                  SHA256: 4a08f921bc82d0119f8a324901bce47102948e918bc320149a1801
                </div>
              </div>

              <!-- Action: Apply to Listing Form -->
              <button type="button" class="btn btn-primary-farmer" id="btnApplyScanToListing" style="width: 100%; padding: 12px; font-weight: 800;">
                ✨ Apply Kisan-Vision Data to Harvest Listing &rarr;
              </button>
            </div>
          </div>
        </div>

        <!-- ================================================================
             MODULE 3: ACTIVE HARVEST CROPS TABLE
             ================================================================ -->
        <div class="card" style="margin-bottom: 2rem;">
          <div class="card-header">
            <h3 class="card-title" style="color: #34d399;">
              🌾 Active Harvest Lots & Tamper-Proof QC Grades
            </h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Real-Time National Farmgate Disintermediation Registry</span>
          </div>

          <div class="table-container">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Lot ID / Crop</th>
                  <th>Variety / Grade</th>
                  <th>Quantity</th>
                  <th>Farmgate Price</th>
                  <th>APMC Benchmark</th>
                  <th>Digital QC Hash</th>
                  <th>Grid Status</th>
                </tr>
              </thead>
              <tbody id="farmerCropsTableBody">
                <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading listed harvest batches...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ================================================================
             MODULE 4: ESCROW PAYOUT LEDGER & DISPATCH TRACKER
             ================================================================ -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title" style="color: #38bdf8;">
              💰 Escrow Payout Ledger & T+1 Settlement Tracker
            </h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Direct Bank Credit (Zero Middleman Deductions)</span>
          </div>

          <div class="table-container">
            <table class="portal-table">
              <thead>
                <tr>
                  <th>Order Ref</th>
                  <th>Produce / Lot</th>
                  <th>Buyer Organization</th>
                  <th>Quantity</th>
                  <th>Total Payout</th>
                  <th>Escrow State</th>
                  <th>Dispatch Schedule</th>
                  <th>Settlement Policy</th>
                </tr>
              </thead>
              <tbody id="farmerPayoutsTableBody">
                <tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">Loading escrow settlement logs...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <!-- Modal: List Harvest Batch Form -->
      <div class="modal-overlay" id="newCropModal">
        <div class="modal-card" style="border-color: rgba(16, 185, 129, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-subtle);">
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              🌱 List New Harvest Crop Batch
            </h3>
            <button id="btnCloseModal" style="background: none; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">&times;</button>
          </div>

          <form id="newCropForm">
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px dashed #10b981; border-radius: 8px; padding: 10px 14px; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <span style="font-size: 0.8rem; color: #a7f3d0;">
                🔬 <strong>AI Quality Pre-Fill:</strong> Let Kisan-Vision analyze your harvest photo for automatic grading & SHA-256 QC Hash.
              </span>
              <button type="button" id="btnQuickScanFromModal" style="background: #10b981; border: none; color: #fff; font-weight: 700; font-size: 0.75rem; padding: 6px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                ✨ Auto-Grade with AI
              </button>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Crop Name</label>
                <input type="text" id="cropName" class="form-control" placeholder="e.g. Solapur Vine-Ripe Tomatoes" required value="Solapur Vine Tomatoes" />
              </div>
              <div class="form-group">
                <label class="form-label">Variety</label>
                <input type="text" id="cropVariety" class="form-control" placeholder="e.g. Abhinav Seminis" required value="Abhinav Hybrid" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Quantity (Quintals / kg)</label>
                <input type="number" id="cropQuantity" class="form-control" placeholder="500" required value="500" />
              </div>
              <div class="form-group">
                <label class="form-label">Farmgate Price (₹ per kg)</label>
                <input type="number" step="0.5" id="cropPrice" class="form-control" placeholder="22.00" required value="22.00" />
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Harvest Date</label>
                <input type="date" id="cropDate" class="form-control" required value="${new Date().toISOString().split('T')[0]}" />
              </div>
              <div class="form-group">
                <label class="form-label">Farmgate Location / FPO Hub</label>
                <input type="text" id="cropLocation" class="form-control" placeholder="Lasalgaon, Nashik, MH" required value="${user.location || 'Lasalgaon, Nashik, Maharashtra'}" />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
              <label class="form-label">QC Grading Standard</label>
              <select id="cropGrade" class="form-control">
                <option value="Grade A+">Grade A+ (Export / Direct Retail Ready)</option>
                <option value="Grade A">Grade A (Standard Consumer Grade)</option>
                <option value="GlobalGAP Certified">GlobalGAP Certified (Zero Chemical Residue)</option>
                <option value="NPOP Organic">NPOP Organic Certified</option>
              </select>
            </div>

            <!-- Pre-filled SHA-256 QC Hash -->
            <div class="form-group" style="margin-bottom: 1.5rem;">
              <label class="form-label">Verified Kisan-Vision QC Hash (Tamper-Proof)</label>
              <input type="text" id="cropQcHash" class="form-control" style="font-family: monospace; font-size: 0.8rem; background: rgba(0,0,0,0.3);" value="SHA256: 4a08f921bc82d0119f8a324901bce47102948e918bc320149a1801" required />
            </div>

            <button type="submit" class="btn btn-primary-farmer" style="width: 100%; padding: 12px; font-weight: 800;">
              Publish Harvest Lot to National Grid &rarr;
            </button>
          </form>
        </div>
      </div>
    `;

    // Logout
    document.getElementById('btnFarmerLogout')?.addEventListener('click', () => {
      KisanVaniVoice.stopSpeech();
      KisanVaniVoice.stopListening();
      const root = document.getElementById('kisanVaniWidgetRoot');
      if (root) root.remove();
      localStorage.removeItem('kd_token');
      localStorage.removeItem('kd_user');
      router.navigate('/');
    });

    // Voice button in header
    document.getElementById('btnHeaderVoice')?.addEventListener('click', () => {
      const trigger = document.getElementById('kisanVaniTriggerBtn');
      const deck = document.getElementById('kisanVaniDeck');
      if (trigger && trigger.style.display !== 'none') {
        trigger.click();
      } else if (deck) {
        deck.style.display = 'block';
      }
    });

    // Modal controls
    const newCropModal = document.getElementById('newCropModal');
    document.getElementById('btnOpenNewCropModal')?.addEventListener('click', () => {
      newCropModal?.classList.add('open');
    });
    document.getElementById('btnCloseModal')?.addEventListener('click', () => {
      newCropModal?.classList.remove('open');
    });

    // ================================================================
    // KISAN-VISION PRESET LOGIC & SCAN TRIGGER
    // ================================================================
    const presetImages = {
      Tomato: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
      Onion: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&w=600&q=80',
      Potato: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
      Apple: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80'
    };

    const presetBtnList = document.querySelectorAll('.crop-preset-btn');
    presetBtnList.forEach(btn => {
      btn.addEventListener('click', (e) => {
        presetBtnList.forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = 'rgba(255,255,255,0.1)';
        });
        e.currentTarget.classList.add('active');
        e.currentTarget.style.borderColor = '#10b981';

        selectedCropPreset = e.currentTarget.getAttribute('data-crop');
        const imgEl = document.getElementById('scanImagePreview');
        if (imgEl && presetImages[selectedCropPreset]) {
          imgEl.src = presetImages[selectedCropPreset];
        }
      });
    });

    // File input handler
    const fileInput = document.getElementById('cropFileInput');
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const imgEl = document.getElementById('scanImagePreview');
          if (imgEl) imgEl.src = evt.target.result;
          selectedCropPreset = file.name.split('.')[0] || 'Custom Crop';
        };
        reader.readAsDataURL(file);
      }
    });

    // Run AI Scan
    async function triggerAiScan() {
      const laser = document.getElementById('scanLaser');
      const reticle = document.getElementById('scanReticle');
      const statusText = document.getElementById('scanStatusText');

      if (laser) laser.style.display = 'block';
      if (reticle) reticle.style.display = 'block';
      if (statusText) statusText.textContent = `Analyzing ${selectedCropPreset} with Computer Vision Neural Net...`;

      try {
        const res = await fetch('/api/farmer/ai-quality-scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ cropType: selectedCropPreset })
        });
        const data = await res.json();

        setTimeout(() => {
          if (laser) laser.style.display = 'none';
          if (reticle) reticle.style.display = 'none';
          if (statusText) statusText.textContent = `Diagnostic Complete: ${data.scan.grade} Certified`;

          if (data.success && data.scan) {
            scannedResult = data.scan;
            document.getElementById('scanGradeBadge').textContent = data.scan.grade;
            document.getElementById('valFreshness').textContent = `${data.scan.freshnessScore}%`;
            document.getElementById('barFreshness').style.width = `${data.scan.freshnessScore}%`;
            document.getElementById('valRipeness').textContent = `${data.scan.ripenessScore}%`;
            document.getElementById('barRipeness').style.width = `${data.scan.ripenessScore}%`;
            document.getElementById('valBlemish').textContent = `${data.scan.blemishRate}%`;
            document.getElementById('barBlemish').style.width = `${Math.min(data.scan.blemishRate * 10, 100)}%`;
            document.getElementById('valDiameter').textContent = `${data.scan.diameterMm} mm`;
            document.getElementById('valPriceDelta').textContent = data.scan.fairPriceDelta;
            document.getElementById('valRecPrice').textContent = `₹${data.scan.recommendedPrice.toFixed(2)}/kg`;
            document.getElementById('valQcHash').textContent = data.scan.qcHash;
          }
        }, 600);
      } catch (err) {
        if (laser) laser.style.display = 'none';
        if (reticle) reticle.style.display = 'none';
        console.error('Scan error:', err);
      }
    }

    document.getElementById('btnRunScan')?.addEventListener('click', triggerAiScan);

    // Apply scan to listing
    document.getElementById('btnApplyScanToListing')?.addEventListener('click', () => {
      if (!scannedResult) {
        // Trigger quick scan if not yet run
        triggerAiScan().then(() => {
          setTimeout(() => applyScanToModal(), 700);
        });
        return;
      }
      applyScanToModal();
    });

    document.getElementById('btnQuickScanFromModal')?.addEventListener('click', async () => {
      const btn = document.getElementById('btnQuickScanFromModal');
      if (btn) btn.textContent = '⏳ Analyzing...';
      await triggerAiScan();
      setTimeout(() => {
        applyScanToModal();
        if (btn) btn.textContent = '✓ AI Data Populated';
      }, 700);
    });

    function applyScanToModal() {
      if (scannedResult) {
        const cropNameInput = document.getElementById('cropName');
        const cropVarietyInput = document.getElementById('cropVariety');
        const cropPriceInput = document.getElementById('cropPrice');
        const cropGradeSelect = document.getElementById('cropGrade');
        const cropQcHashInput = document.getElementById('cropQcHash');

        if (cropNameInput) cropNameInput.value = `${scannedResult.cropType} (${scannedResult.grade})`;
        if (cropVarietyInput) cropVarietyInput.value = 'Certified Premium Hybrid';
        if (cropPriceInput) cropPriceInput.value = scannedResult.recommendedPrice.toFixed(2);
        if (cropGradeSelect) cropGradeSelect.value = scannedResult.grade.includes('GlobalGAP') ? 'GlobalGAP Certified' : 'Grade A+';
        if (cropQcHashInput) cropQcHashInput.value = scannedResult.qcHash;

        newCropModal?.classList.add('open');
      }
    }

    // ================================================================
    // LOAD MARKET ADVISORY DATA
    // ================================================================
    async function loadMarketAdvisory() {
      try {
        const res = await fetch('/api/farmer/market-advisory', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.advisory) {
          const adv = data.advisory;
          const hHeadline = document.getElementById('advHeadline');
          const hStrategy = document.getElementById('advStrategy');
          const hNetGain = document.getElementById('advNetGain');
          const hEvent = document.getElementById('advEvent');
          const hDemandIndex = document.getElementById('advDemandIndex');
          const hBadges = document.getElementById('advSurgeBadges');

          if (hHeadline) hHeadline.textContent = adv.holdingRecommendations.headline;
          if (hStrategy) hStrategy.textContent = adv.holdingRecommendations.strategy;
          if (hNetGain) hNetGain.textContent = adv.holdingRecommendations.projectedNetGain;
          if (hEvent) hEvent.textContent = adv.festivalSurge.event;
          if (hDemandIndex) hDemandIndex.textContent = adv.festivalSurge.demandIndex;
          if (hBadges && adv.festivalSurge.surgingCrops) {
            hBadges.innerHTML = adv.festivalSurge.surgingCrops.map(c => `
              <span class="badge badge-pending" style="font-size: 0.78rem;">${c.crop} (${c.surge})</span>
            `).join('');
          }
        }
      } catch (err) {
        console.error('Error loading advisory:', err);
      }
    }

    loadMarketAdvisory();

    // ================================================================
    // LOAD CROPS & PAYOUTS
    // ================================================================
    async function loadFarmerData() {
      try {
        // Crops
        const resCrops = await fetch('/api/farmer/crops', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataCrops = await resCrops.json();

        if (dataCrops.success) {
          const tbody = document.getElementById('farmerCropsTableBody');
          const countEl = document.getElementById('farmerActiveLots');
          if (countEl) countEl.textContent = `${dataCrops.crops.length} Lots`;

          if (tbody) {
            if (dataCrops.crops.length === 0) {
              tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No crops listed yet. Click "+ List Harvest Batch" above!</td></tr>';
            } else {
              tbody.innerHTML = dataCrops.crops.map(c => `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #fff;">${c.crop_name}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">${c.id}</div>
                  </td>
                  <td>
                    <div>${c.variety}</div>
                    <span class="badge badge-available">${c.qc_grade}</span>
                  </td>
                  <td><strong>${c.quantity_kg} kg</strong></td>
                  <td><strong style="color: #34d399; font-size: 0.95rem;">₹${c.farmgate_price.toFixed(2)}/kg</strong></td>
                  <td><span style="color: var(--text-muted); text-decoration: line-through;">₹${c.mandi_benchmark_price.toFixed(2)}/kg</span></td>
                  <td>
                    <span style="font-family: monospace; font-size: 0.72rem; color: #94a3b8; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 4px;" title="${c.qc_hash}">
                      ${c.qc_hash.slice(0, 18)}...
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-${c.status === 'available' ? 'available' : c.status === 'reserved' ? 'pending' : 'approved'}">
                      ${c.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              `).join('');
            }
          }
        }

        // Payouts
        const resPayouts = await fetch('/api/farmer/payouts', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataPayouts = await resPayouts.json();

        if (dataPayouts.success) {
          const tbodyP = document.getElementById('farmerPayoutsTableBody');
          const totalEl = document.getElementById('farmerTotalEarnings');
          if (totalEl && dataPayouts.summary.totalEarnings > 0) {
            totalEl.textContent = `₹ ${dataPayouts.summary.totalEarnings.toLocaleString('en-IN')}`;
          }

          if (tbodyP) {
            if (dataPayouts.orders.length === 0) {
              tbodyP.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No orders placed yet. Orders will settle via T+1 Direct Bank Escrow.</td></tr>';
            } else {
              tbodyP.innerHTML = dataPayouts.orders.map(o => `
                <tr>
                  <td><strong style="color: #fff;">#${o.order_number}</strong></td>
                  <td>${o.crop_name}</td>
                  <td><span style="color: #38bdf8; font-weight: 600;">${o.buyer_name}</span></td>
                  <td>${o.quantity} kg</td>
                  <td><strong style="color: #34d399; font-size: 0.95rem;">₹${o.total_amount.toLocaleString('en-IN')}</strong></td>
                  <td><span class="badge badge-${o.escrow_status === 'settled' ? 'available' : 'pending'}">${o.escrow_status.toUpperCase()}</span></td>
                  <td><span style="font-size: 0.8rem; color: #fbbf24;">${o.pickup_schedule || 'Awaiting Reefer Slot'}</span></td>
                  <td><span style="font-size: 0.78rem; color: #34d399;">T+1 Direct Settled</span></td>
                </tr>
              `).join('');
            }
          }
        }
      } catch (err) {
        console.error('Error loading farmer data:', err);
      }
    }

    loadFarmerData();

    // Form submit
    document.getElementById('newCropForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        crop_name: document.getElementById('cropName').value,
        variety: document.getElementById('cropVariety').value,
        quantity_kg: document.getElementById('cropQuantity').value,
        farmgate_price: document.getElementById('cropPrice').value,
        harvest_date: document.getElementById('cropDate').value,
        location: document.getElementById('cropLocation').value,
        qc_grade: document.getElementById('cropGrade').value,
        qc_hash: document.getElementById('cropQcHash').value,
        freshness_score: scannedResult ? scannedResult.freshnessScore : 96.5,
        ripeness_score: scannedResult ? scannedResult.ripenessScore : 94.0,
        blemish_rate: scannedResult ? scannedResult.blemishRate : 1.2,
        diameter_mm: scannedResult ? scannedResult.diameterMm : 62.0
      };

      try {
        const res = await fetch('/api/farmer/crops', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
          alert(`Success: Batch ${data.lot.id} published to National Grid with SHA-256 QC Hash!`);
          newCropModal?.classList.remove('open');
          loadFarmerData();
        } else {
          alert('Error: ' + (data.message || data.error));
        }
      } catch (err) {
        alert('Network error while creating crop batch.');
      }
    });

    // Mount Kisan Vani Voice Copilot Floating Widget
    KisanVaniVoice.render();
  }
};
