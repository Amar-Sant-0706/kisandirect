import { SplashView } from './views/splash/splashView.js';
import { AuthView } from './views/auth/authView.js';
import { FarmerView } from './views/farmer/farmerView.js';
import { BuyerView } from './views/buyer/buyerView.js';
import { OwnerView } from './views/owner/ownerView.js';

export const Router = {
  routes: {
    '/': { view: SplashView, guard: null },
    '/auth/login': { view: AuthView, guard: null },
    '/farmer/dashboard': { view: FarmerView, guard: 'farmer' },
    '/buyer/marketplace': { view: BuyerView, guard: 'buyer' },
    '/owner/control-room': { view: OwnerView, guard: 'owner' }
  },

  init(containerId = 'app') {
    this.container = document.getElementById(containerId);

    // Global navigation interceptor
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('href');
        this.navigate(href);
      }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      this.resolveCurrentRoute();
    });

    this.resolveCurrentRoute();
  },

  navigate(pathWithQuery) {
    window.history.pushState({}, '', pathWithQuery);
    this.resolveCurrentRoute();
  },

  resolveCurrentRoute() {
    const fullPath = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(searchParams.entries());

    // Normalize route pattern
    let matchedRoute = this.routes[fullPath];

    // Subpath or default matching
    if (!matchedRoute) {
      if (fullPath.startsWith('/farmer')) {
        matchedRoute = this.routes['/farmer/dashboard'];
      } else if (fullPath.startsWith('/buyer')) {
        matchedRoute = this.routes['/buyer/marketplace'];
      } else if (fullPath.startsWith('/owner')) {
        matchedRoute = this.routes['/owner/control-room'];
      } else if (fullPath.startsWith('/auth')) {
        matchedRoute = this.routes['/auth/login'];
      } else {
        matchedRoute = this.routes['/'];
      }
    }

    // Role Guard Check
    if (matchedRoute.guard) {
      const token = localStorage.getItem('kd_token');
      const userStr = localStorage.getItem('kd_user');
      let user = null;
      try { user = JSON.parse(userStr); } catch (e) {}

      if (!token || !user || user.role !== matchedRoute.guard) {
        console.warn(`[RouteGuard] Access blocked to ${fullPath}: User role is "${user ? user.role : 'none'}", required: "${matchedRoute.guard}"`);
        this.navigate(`/auth/login?role=${matchedRoute.guard}`);
        return;
      }
    }

    // Clean up any portal-specific floating widgets
    const floatingVoice = document.getElementById('kisanVaniWidgetRoot');
    if (floatingVoice) floatingVoice.remove();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    // Render View
    if (matchedRoute && matchedRoute.view) {
      matchedRoute.view.render(this.container, this, params);
      window.scrollTo(0, 0);
    }
  }
};

window.Router = Router;
