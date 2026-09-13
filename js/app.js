/**
 * KisanDirect AI - Main Application Coordinator, Role Switcher & Auth Gate
 */

window.App = {
  currentRole: 'marketplace',

  async init() {
    console.log("Initializing KisanDirect AI platform with Security Gate...");
    this.bindNavigation();
    
    // Check existing authentication session
    if (window.KisanData && window.KisanData.checkAuth) {
      await window.KisanData.checkAuth();
    }

    // Render User session widget in nav
    this.renderUserNav();

    // Load initial data from universal REST API
    if (window.KisanData && window.KisanData.loadInitialData) {
      await window.KisanData.loadInitialData();
    }

    // Initialize child modules
    if (window.MarketplaceModule) await window.MarketplaceModule.init();
    if (window.AIVisionModule) window.AIVisionModule.init();
    if (window.AIForecastingModule) window.AIForecastingModule.init();
    if (window.RouteOptimizerModule) window.RouteOptimizerModule.init();
    if (window.DOCAMonitorModule) await window.DOCAMonitorModule.init();

    this.initLucideIcons();

    // If returning as farmer, default to farmer portal view
    if (KisanData.currentUser && (KisanData.currentUser.role === 'Farmer' || KisanData.currentUser.role === 'FPO_Member')) {
      this.switchRole('farmer');
    }
  },

  bindNavigation() {
    const personaBtns = document.querySelectorAll('.persona-btn');
    personaBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const role = e.currentTarget.getAttribute('data-role');
        this.switchRole(role);
      });
    });

    // Cart button in nav
    const cartBtn = document.getElementById('cartNavBtn');
    if (cartBtn) {
      cartBtn.addEventListener('click', () => {
        MarketplaceModule.openCartModal();
      });
    }

    // Modal background click to close
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
        }
      });
    });
  },

  renderUserNav() {
    const container = document.getElementById('navUserSection');
    if (!container) return;

    if (KisanData.currentUser) {
      const u = KisanData.currentUser;
      const initial = (u.name || 'U').charAt(0).toUpperCase();
      let roleBadge = 'badge-grade-a';
      if (u.role === 'B2B_Buyer') roleBadge = 'badge-warning';
      else if (u.role === 'FPO_Member') roleBadge = 'badge-organic';
      else if (u.role === 'Consumer') roleBadge = 'badge-grade-b';

      container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-full); padding: 4px 12px 4px 6px;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--emerald-500); color: #fff; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; justify-content: center;">
            ${initial}
          </div>
          <div style="line-height: 1.2;">
            <div style="font-size: 0.8rem; font-weight: 700; color: #fff;">${u.name}</div>
            <div style="font-size: 0.68rem; color: var(--text-muted);">${u.district_state || u.role}</div>
          </div>
          <span class="badge ${roleBadge}" style="font-size: 0.65rem; padding: 2px 6px;">${u.role}</span>
          <button class="btn btn-ghost btn-sm" onclick="App.logout()" title="Sign out" style="padding: 4px 6px; font-size: 0.72rem; color: var(--rose-400); margin-left: 2px;">
            <i data-lucide="log-out" style="width: 14px; height: 14px;"></i>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="App.openAuthModal()">
          <i data-lucide="shield-check"></i> Sign In / Register
        </button>
      `;
    }

    this.initLucideIcons();
  },

  openAuthModal(noticeMessage = null) {
    const modal = document.getElementById('authModalGate');
    if (!modal) return;

    if (noticeMessage && window.MarketplaceModule) {
      MarketplaceModule.showToast(noticeMessage, 'warning');
    }

    modal.classList.add('open');
    this.initLucideIcons();
  },

  closeAuthModal() {
    const modal = document.getElementById('authModalGate');
    if (modal) modal.classList.remove('open');
  },

  switchAuthTab(tab) {
    const tabSignIn = document.getElementById('authTabSignIn');
    const tabRegister = document.getElementById('authTabRegister');
    const signInForm = document.getElementById('signInForm');
    const registerForm = document.getElementById('registerForm');

    if (tab === 'signin') {
      tabSignIn.style.background = 'var(--emerald-500)';
      tabSignIn.style.color = '#fff';
      tabRegister.style.background = 'transparent';
      tabRegister.style.color = 'var(--text-secondary)';
      signInForm.style.display = 'block';
      registerForm.style.display = 'none';
    } else {
      tabRegister.style.background = 'var(--emerald-500)';
      tabRegister.style.color = '#fff';
      tabSignIn.style.background = 'transparent';
      tabSignIn.style.color = 'var(--text-secondary)';
      signInForm.style.display = 'none';
      registerForm.style.display = 'block';
    }
  },

  async quickLogin(roleKey) {
    const creds = {
      farmer: { email: 'farmer@kisandirect.gov.in', password: 'farmer123' },
      fpo: { email: 'fpo@sahyadri.coop', password: 'fpo123' },
      buyer: { email: 'procurement@reliancefresh.com', password: 'buyer123' },
      consumer: { email: 'consumer@gmail.com', password: 'consumer123' }
    };

    const cred = creds[roleKey];
    if (!cred) return;

    document.getElementById('signInEmail').value = cred.email;
    document.getElementById('signInPassword').value = cred.password;
    this.switchAuthTab('signin');

    try {
      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Signing in as ${roleKey.toUpperCase()}...`, 'info');
      }
      await KisanData.login(cred.email, cred.password);
      this.closeAuthModal();
      this.renderUserNav();

      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Logged in as ${KisanData.currentUser.name} (${KisanData.currentUser.role})`, 'success');
        await MarketplaceModule.renderFarmerBatches();
        MarketplaceModule.renderProducts();
      }

      if (roleKey === 'farmer' || roleKey === 'fpo') {
        this.switchRole('farmer');
      } else {
        this.switchRole('marketplace');
      }
    } catch (e) {
      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Login failed: ${e.message}`, 'error');
      }
    }
  },

  async handleSignInSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value.trim();
    const password = document.getElementById('signInPassword').value;

    try {
      if (window.MarketplaceModule) {
        MarketplaceModule.showToast("Authenticating credentials...", "info");
      }
      const data = await KisanData.login(email, password);
      this.closeAuthModal();
      this.renderUserNav();

      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Welcome back, ${data.user.name}!`, 'success');
        await MarketplaceModule.renderFarmerBatches();
        MarketplaceModule.renderProducts();
      }

      if (data.user.role === 'Farmer' || data.user.role === 'FPO_Member') {
        this.switchRole('farmer');
      }
    } catch (err) {
      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Error: ${err.message}`, 'error');
      }
    }
  },

  async handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const role = document.getElementById('regRole').value;
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const phone = document.getElementById('regPhone').value.trim();
    const district_state = document.getElementById('regDistrict').value.trim();

    try {
      if (window.MarketplaceModule) {
        MarketplaceModule.showToast("Registering account...", "info");
      }
      const data = await KisanData.register({
        name,
        role,
        email,
        password,
        phone,
        district_state
      });

      this.closeAuthModal();
      this.renderUserNav();

      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Account created! Welcome to KisanDirect, ${data.user.name}`, 'success');
        await MarketplaceModule.renderFarmerBatches();
        MarketplaceModule.renderProducts();
      }

      if (role === 'Farmer' || role === 'FPO_Member') {
        this.switchRole('farmer');
      }
    } catch (err) {
      if (window.MarketplaceModule) {
        MarketplaceModule.showToast(`Registration error: ${err.message}`, 'error');
      }
    }
  },

  logout() {
    KisanData.logout();
    this.renderUserNav();
    if (window.MarketplaceModule) {
      MarketplaceModule.showToast("You have been signed out.", "info");
      MarketplaceModule.renderFarmerBatches();
    }
    this.openAuthModal();
  },

  switchRole(role) {
    this.currentRole = role;

    // Update nav buttons
    document.querySelectorAll('.persona-btn').forEach(btn => {
      if (btn.getAttribute('data-role') === role) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update visible view panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      if (panel.id === `view-${role}`) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Invalidate Leaflet map size if switching to logistics tab
    if (role === 'logistics' && window.RouteOptimizerModule && window.RouteOptimizerModule.map) {
      setTimeout(() => {
        window.RouteOptimizerModule.map.invalidateSize();
      }, 200);
    }

    // Resize chart and refresh if switching to forecasting tab
    if (role === 'forecasting' && window.AIForecastingModule) {
      if (window.AIForecastingModule.chartInstance) {
        setTimeout(() => {
          window.AIForecastingModule.chartInstance.resize();
        }, 200);
      }
    }

    this.initLucideIcons();
  },

  initLucideIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.App.init();
});
