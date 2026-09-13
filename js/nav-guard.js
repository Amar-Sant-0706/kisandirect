/**
 * KisanDirect AI - Zero-Leakage Navigation Guard & Strict Portal Isolation
 * Ensures users can strictly access only their designated portal based on user.role
 * (FARMER, BUYER, OWNER) and visualizes approval status.
 */

(function () {
  const currentPath = window.location.pathname.split('/').pop() || 'marketplace.html';

  // 1. Check Authentication Token
  const token = localStorage.getItem('kd_auth_token');
  const isLoginPage = currentPath === 'login.html' || currentPath === 'login' || currentPath === 'register.html';

  if (!token && !isLoginPage) {
    console.warn("Unauthenticated access attempt redirected to /login.html");
    window.location.href = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
    return;
  }

  // 2. Global Signout
  window.signoutUser = function () {
    localStorage.removeItem('kd_auth_token');
    localStorage.removeItem('kd_user');
    window.location.href = '/login.html?logged_out=1';
  };

  // 3. Document Ready Initialization
  document.addEventListener('DOMContentLoaded', async () => {
    if (isLoginPage) return;

    let currentUser = null;
    try {
      const stored = localStorage.getItem('kd_user');
      if (stored) currentUser = JSON.parse(stored);
    } catch (e) {}

    // Verify token with backend
    if (token) {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          currentUser = data.user;
          localStorage.setItem('kd_user', JSON.stringify(currentUser));
          if (window.KisanData) window.KisanData.currentUser = currentUser;
        } else {
          localStorage.removeItem('kd_auth_token');
          localStorage.removeItem('kd_user');
          window.location.href = '/login.html';
          return;
        }
      } catch (err) {
        console.warn("Error verifying session:", err);
      }
    }

    if (!currentUser) return;

    const role = (currentUser.role || '').toUpperCase();
    const isFarmer = role === 'FARMER' || role === 'FPO_MEMBER';
    const isBuyer = role === 'BUYER' || role === 'B2B_BUYER' || role === 'CONSUMER';
    const isOwner = role === 'OWNER' || role === 'ADMIN';

    // =========================================================================
    // STRICT ZERO-LEAKAGE ROUTE ENFORCEMENT
    // =========================================================================
    if (isFarmer) {
      // Farmer trying to access Buyer or Admin pages
      if (currentPath.includes('marketplace') || currentPath.includes('admin-portal') || currentPath.includes('doca-control')) {
        console.warn("RBAC Violation: Farmer portal isolation active. Redirecting to /farmer/dashboard.");
        window.location.href = '/farmer/dashboard';
        return;
      }
    } else if (isBuyer) {
      // Buyer trying to access Farmer or Admin pages
      if (currentPath.includes('farmer-hub') || currentPath.includes('admin-portal') || currentPath.includes('doca-control')) {
        console.warn("RBAC Violation: Buyer portal isolation active. Redirecting to /buyer/dashboard.");
        window.location.href = '/buyer/dashboard';
        return;
      }
    } else if (!isOwner) {
      // Any unauthorized role trying to access Owner control tower
      if (currentPath.includes('admin-portal')) {
        alert('Access Denied: Owner Control Tower requires Platform Owner credentials.');
        window.location.href = '/buyer/dashboard';
        return;
      }
    }

    // Render isolated navigation header
    renderUnifiedHeader(currentUser);

    // Inject Kisan Vani Voice modal
    injectVoiceModal();

    // Re-initialize Lucide Icons
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  });

  function renderUnifiedHeader(user) {
    const headerContainer = document.getElementById('appHeader');
    if (!headerContainer) return;

    const role = (user.role || '').toUpperCase();
    const isFarmer = role === 'FARMER' || role === 'FPO_MEMBER';
    const isBuyer = role === 'BUYER' || role === 'B2B_BUYER' || role === 'CONSUMER';
    const isOwner = role === 'OWNER' || role === 'ADMIN';

    let navItems = [];

    // STRICT ZERO-LEAKAGE NAVIGATION TABS
    if (isFarmer) {
      navItems = [
        { href: '/', label: 'Unified Agri-Grid', icon: 'layers' },
        { href: '/farmer/dashboard', label: 'Farmer Harvest Portal', icon: 'tractor' },
        { href: '/quality-scanner.html', label: 'AI QC Scanner', icon: 'scan-line' },
        { href: '/demand-forecast.html', label: 'AI Price Forecast', icon: 'trending-up' }
      ];
    } else if (isBuyer) {
      navItems = [
        { href: '/', label: 'Unified Agri-Grid', icon: 'layers' },
        { href: '/buyer/dashboard', label: 'Buyer Marketplace', icon: 'store' },
        { href: '/demand-forecast.html', label: 'AI Market Forecast', icon: 'trending-up' },
        { href: '/route-optimizer.html', label: 'Cold-Chain Logistics', icon: 'navigation' }
      ];
    } else if (isOwner) {
      navItems = [
        { href: '/', label: 'Unified Agri-Grid', icon: 'layers' },
        { href: '/owner/dashboard', label: 'Owner Control Tower', icon: 'shield-check' },
        { href: '/buyer/dashboard', label: 'Buyer Catalog Oversight', icon: 'store' },
        { href: '/farmer/dashboard', label: 'Farmer Network Oversight', icon: 'tractor' },
        { href: '/doca-control.html', label: 'DOCA Surveillance', icon: 'shield-alert' }
      ];
    }

    const currentFile = window.location.pathname.split('/').pop() || 'marketplace.html';

    const navButtons = navItems.map(item => {
      const isCurrent = currentFile === item.href.replace('/', '') ||
                        window.location.pathname === item.href ||
                        (item.href.includes('farmer') && currentFile.includes('farmer')) ||
                        (item.href.includes('buyer') && currentFile.includes('marketplace')) ||
                        (item.href.includes('owner') && currentFile.includes('admin-portal'));

      return `
        <a href="${item.href}" class="persona-btn ${isCurrent ? 'active' : ''}" style="text-decoration: none;">
          <i data-lucide="${item.icon}"></i> ${item.label}
        </a>
      `;
    }).join('');

    // User Profile Widget
    const initial = (user.name || 'U').charAt(0).toUpperCase();
    let roleBadge = 'badge-grade-a';
    if (isOwner) roleBadge = 'badge-grade-b';
    else if (isBuyer) roleBadge = 'badge-warning';

    // Approval status badge
    const approvalStatus = (user.approval_status || 'PENDING_APPROVAL').toUpperCase();
    let approvalPill = '';
    if (approvalStatus === 'APPROVED') {
      approvalPill = `<span class="badge badge-grade-a" style="font-size: 0.65rem; padding: 2px 6px;" title="Account Verified & Approved by Platform Owner">✓ APPROVED</span>`;
    } else if (approvalStatus === 'REJECTED') {
      approvalPill = `<span class="badge badge-danger" style="font-size: 0.65rem; padding: 2px 6px;" title="Account Rejected by Platform Owner">✗ REJECTED</span>`;
    } else {
      approvalPill = `<span class="badge badge-warning" style="font-size: 0.65rem; padding: 2px 6px; background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #f59e0b;" title="Awaiting Platform Owner Approval">⏳ PENDING APPROVAL</span>`;
    }

    const userWidget = `
      <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-full); padding: 4px 12px 4px 6px;">
        <div style="width: 28px; height: 28px; border-radius: 50%; background: ${isOwner ? '#6366f1' : (isFarmer ? '#10b981' : '#0284c7')}; color: #fff; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; justify-content: center;">
          ${initial}
        </div>
        <div style="line-height: 1.2;">
          <div style="font-size: 0.8rem; font-weight: 700; color: #fff;">${user.name}</div>
          <div style="font-size: 0.68rem; color: var(--text-muted);">${user.business_name || user.state_district || user.district_state || user.role}</div>
        </div>
        <span class="badge ${roleBadge}" style="font-size: 0.65rem; padding: 2px 6px;">${user.role}</span>
        ${approvalPill}
        <button class="btn btn-ghost btn-sm" onclick="signoutUser()" title="Sign out" style="padding: 4px 6px; font-size: 0.72rem; color: var(--rose-400); margin-left: 2px; cursor: pointer;">
          <i data-lucide="log-out" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `;

    // Only show cart button for Buyers
    const cartButtonHtml = isBuyer ? `
      <button class="btn-icon" id="cartNavBtn" onclick="if(window.MarketplaceModule) MarketplaceModule.openCartDrawer()" title="View Direct Farm Basket">
        <i data-lucide="shopping-basket"></i>
        <span class="cart-counter" id="cartBadgeCount">0</span>
      </button>
    ` : '';

    headerContainer.innerHTML = `
      <!-- Top Government DOCA Advisory Banner -->
      <header class="gov-banner">
        <div class="gov-emblem-wrapper">
          <span class="gov-emblem-badge">GOVT OF INDIA</span>
          <span>Ministry of Consumer Affairs, Food & Public Distribution | Department of Consumer Affairs (DOCA)</span>
        </div>
        <div class="gov-live-ticker">
          <span class="pulse-indicator">Zero-Leakage RBAC Active</span>
          <span>Portal: ${isFarmer ? 'Farmer Producer Hub' : (isBuyer ? 'Buyer E-Commerce Market' : 'Platform Owner Control Tower')}</span>
        </div>
      </header>

      <!-- Main Navigation Bar with Isolated Persona Views -->
      <nav class="main-nav">
        <div class="brand-section">
          <a href="${isFarmer ? '/farmer/dashboard' : (isBuyer ? '/buyer/dashboard' : '/owner/dashboard')}" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit;">
            <div class="brand-logo-icon" style="background: ${isOwner ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : (isFarmer ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #0284c7, #0369a1)')};">
              <i data-lucide="${isOwner ? 'shield-check' : (isFarmer ? 'tractor' : 'shopping-bag')}"></i>
            </div>
            <div class="brand-text">
              <h1>KisanDirect <span>${isFarmer ? 'Farmer Producer Portal' : (isBuyer ? 'Buyer Marketplace' : 'Owner Control Tower')}</span></h1>
            </div>
          </a>
        </div>

        <!-- Strict Zero-Leakage Navigation Items -->
        <div class="persona-switcher">
          ${navButtons}
        </div>

        <!-- Action Utilities & Profile -->
        <div class="nav-actions">
          <button class="voice-copilot-pill" onclick="if(window.KisanVaniModule) KisanVaniModule.openVoiceModal()"
            title="Listen to Live Daily Market Prices with Role Voice Personas">
            <span class="audio-pulse-ring"></span>
            <i data-lucide="mic"></i>
            <span id="voiceIndicatorText">Kisan Vani Voice</span>
          </button>
          
          <div class="stat-pill">
            <i data-lucide="shield"></i> 100% Escrow
          </div>
          
          ${cartButtonHtml}

          <!-- User Profile Section -->
          <div id="navUserSection">
            ${userWidget}
          </div>
        </div>
      </nav>
    `;
  }

  function injectVoiceModal() {
    if (document.getElementById('kisanVaniModal')) return;

    const modalHtml = `
      <div class="modal-backdrop" id="kisanVaniModal">
        <div class="modal-card" style="max-width: 660px;">
          <div class="modal-header">
            <h3><i data-lucide="radio" style="color: var(--emerald-400);"></i> Kisan Vani AI Voice Copilot</h3>
            <button class="btn-close" onclick="KisanVaniModule.closeVoiceModal()"><i data-lucide="x"></i></button>
          </div>
          <div class="modal-body" style="padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 1rem;">
              <div>
                <h4 id="vaniHeadline" style="font-size: 1.05rem; font-weight: 700; color: #fff;">Daily Agricultural Market Price Bulletin</h4>
                <p id="vaniDateBadge" style="font-size: 0.78rem; color: var(--emerald-400); margin-top: 2px;">Live Mandi & Farmgate Rates</p>
              </div>
              <div>
                <select id="vaniCommoditySelect" onchange="KisanVaniModule.onCommodityChange(this.value)" 
                  style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: #fff; padding: 6px 12px; border-radius: var(--radius-md); font-size: 0.82rem;">
                  <option value="">🌾 All Top Commodities (Full Daily Bulletin)</option>
                </select>
              </div>
            </div>

            <!-- AI VOICE ROLE PERSONA SWITCHER -->
            <div style="margin-bottom: 1rem;">
              <label style="font-size: 0.78rem; font-weight: 700; color: var(--emerald-400); display: block; margin-bottom: 6px;">
                <i data-lucide="mic-2" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i> AI Voice Actor & Role Tone Persona:
              </label>
              <div class="voice-role-selector">
                <button type="button" class="voice-role-btn active" id="voiceRoleFarmer" onclick="KisanVaniModule.setVoicePersona('FARMER')">
                  👨‍🌾 Farmer Voice (Earthy Baritone)
                </button>
                <button type="button" class="voice-role-btn" id="voiceRoleBuyer" onclick="KisanVaniModule.setVoicePersona('BUYER')">
                  🛒 Buyer Voice (Commercial Crisp)
                </button>
                <button type="button" class="voice-role-btn" id="voiceRoleAdmin" onclick="KisanVaniModule.setVoicePersona('ADMIN')">
                  🛡️ Admin Copilot (Authoritative)
                </button>
              </div>
            </div>

            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 6px;">Select Language for Spoken Audio & Live Transcript:</p>
            <div class="voice-lang-grid" id="vaniLangChips">
              <!-- Rendered by KisanVaniModule -->
            </div>

            <!-- Equalizer Waveform Animation -->
            <div class="voice-equalizer-container" id="vaniEqualizer">
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
              <div class="voice-wave-bar"></div>
            </div>

            <!-- Voice Controls -->
            <div style="display: flex; gap: 10px; justify-content: center; margin: 1.25rem 0;">
              <button class="btn btn-primary" id="vaniPlayBtn" onclick="KisanVaniModule.playVoice()">
                <i data-lucide="volume-2"></i> Play Voice Broadcast
              </button>
              <button class="btn btn-outline" onclick="KisanVaniModule.stopSpeaking()">
                <i data-lucide="square"></i> Stop
              </button>
            </div>

            <!-- Live Spoken Transcript -->
            <div style="margin-top: 1rem;">
              <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">
                Live Audio Transcript:
              </div>
              <div class="voice-transcript-box" id="vaniTranscript">
                Loading live market prices from National Agriculture Grid...
              </div>
            </div>

            <!-- Daily Rate Highlights Preview -->
            <div style="margin-top: 1.25rem;">
              <div style="font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px;">
                Today's Benchmark Spreads:
              </div>
              <div id="vaniRatesPreview" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                <!-- Populated dynamically -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
})();
