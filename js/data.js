/**
 * KisanDirect AI - Core Data Client & State Store
 * Ministry of Consumer Affairs, Food & Public Distribution (DOCA)
 */

window.KisanData = {
  commodities: [],
  batches: [],
  categories: [],
  docaPriceWatch: [],
  currentForecast: null,

  // Authentication State
  token: localStorage.getItem('kd_auth_token') || null,
  currentUser: JSON.parse(localStorage.getItem('kd_user') || localStorage.getItem('kd_auth_user') || 'null'),

  authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const tok = this.token || localStorage.getItem('kd_auth_token');
    if (tok) {
      headers['Authorization'] = `Bearer ${tok}`;
    }
    return headers;
  },

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Login failed');

    this.token = data.token;
    this.currentUser = data.user;
    localStorage.setItem('kd_auth_token', data.token);
    localStorage.setItem('kd_user', JSON.stringify(data.user));
    localStorage.setItem('kd_auth_user', JSON.stringify(data.user));
    return data;
  },

  async register(userData) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Registration failed');

    this.token = data.token;
    this.currentUser = data.user;
    localStorage.setItem('kd_auth_token', data.token);
    localStorage.setItem('kd_user', JSON.stringify(data.user));
    localStorage.setItem('kd_auth_user', JSON.stringify(data.user));
    return data;
  },

  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('kd_auth_token');
    localStorage.removeItem('kd_user');
    localStorage.removeItem('kd_auth_user');
  },

  async checkAuth() {
    this.token = localStorage.getItem('kd_auth_token');
    if (!this.token) {
      this.currentUser = null;
      return null;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.authHeaders()
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.currentUser = data.user;
        localStorage.setItem('kd_user', JSON.stringify(data.user));
        localStorage.setItem('kd_auth_user', JSON.stringify(data.user));
        return data.user;
      } else {
        this.logout();
        return null;
      }
    } catch (e) {
      console.warn("Session check failed, clearing local token:", e);
      this.logout();
      return null;
    }
  },

  // Initialize and load dynamic data from universal REST API
  async loadInitialData() {
    try {
      const [commRes, batchRes, docaRes] = await Promise.all([
        fetch('/api/commodities').then(r => r.json()),
        fetch('/api/batches', { headers: this.authHeaders() }).then(r => r.json()),
        fetch('/api/doca/surveillance').then(r => r.json())
      ]);

      if (commRes && commRes.success) {
        this.commodities = commRes.commodities;
        this.categories = Object.keys(commRes.grouped || {});
      }

      if (batchRes && batchRes.success) {
        this.batches = batchRes.batches;
      }

      if (docaRes && docaRes.success) {
        this.docaPriceWatch = docaRes.surveillance;
      }

      return true;
    } catch (e) {
      console.warn("API load error, using cached fallback data:", e);
      return false;
    }
  },

  // Logistics corridor scenario data
  logisticsCorridor: {
    corridorName: "Western Agri-Express: Nashik Cluster to Greater Mumbai Hubs",
    vehicle: {
      regNumber: "MH-15-EG-4921",
      driverName: "Dnyaneshwar Shinde",
      vehicleType: "14-Ft Reefer Van (4.5 Ton Capacity)",
      currentStatus: "En-Route Aggregation",
      temperatureTarget: "4.0°C",
      temperatureCurrent: "4.2°C",
      humidity: "86%",
      etaRemaining: "2h 45m"
    },
    waypoints: [
      {
        id: "W-01",
        name: "Farm 1: Dindori Agro Orchard",
        type: "farm-pickup",
        lat: 20.2012,
        lng: 73.8340,
        cargo: "12 Quintals Red Onion",
        pickupTime: "05:30 AM",
        status: "Completed"
      },
      {
        id: "W-02",
        name: "Farm 2: Niphad Krishi Farm",
        type: "farm-pickup",
        lat: 20.0784,
        lng: 74.1082,
        cargo: "15 Quintals Red Onion",
        pickupTime: "06:45 AM",
        status: "Completed"
      },
      {
        id: "W-03",
        name: "Farm 3: Lasalgaon Smallholders Pool",
        type: "farm-pickup",
        lat: 20.1472,
        lng: 74.2301,
        cargo: "18 Quintals Red Onion",
        pickupTime: "08:10 AM",
        status: "Loading"
      },
      {
        id: "W-04",
        name: "Sahyadri FPO Pre-Cooling Hub",
        type: "hub",
        lat: 20.0334,
        lng: 73.9100,
        cargo: "Quality QC & Cold Staging",
        pickupTime: "10:30 AM",
        status: "Scheduled"
      },
      {
        id: "W-05",
        name: "Mumbai B2C Micro-Fulfillment Center (Kurla)",
        type: "delivery",
        lat: 19.0726,
        lng: 72.8797,
        cargo: "Consumer Farm-Box Distribution",
        pickupTime: "02:15 PM",
        status: "Scheduled"
      },
      {
        id: "W-06",
        name: "Navi Mumbai B2B Institutional Depot (Vashi)",
        type: "delivery",
        lat: 19.0771,
        lng: 72.9986,
        cargo: "Bulk Restaurant & Supermarket Dispatch",
        pickupTime: "03:45 PM",
        status: "Scheduled"
      }
    ],
    traditionalVsAIOptimized: {
      traditionalDistanceKm: 342,
      optimizedDistanceKm: 268,
      kmSaved: 74,
      traditionalTimeHours: 9.5,
      optimizedTimeHours: 6.8,
      timeSavedHours: 2.7,
      fuelCostSavedINR: 4250,
      carbonReductionKg: 86.4,
      spoilageReductionPct: 18.5
    }
  }
};
