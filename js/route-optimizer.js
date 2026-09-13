/**
 * KisanDirect AI - Route Optimization (VRP) & GIS Telemetry Module
 */

window.RouteOptimizerModule = {
  map: null,
  markersLayer: null,
  routePolyline: null,
  optimizedPolyline: null,

  init() {
    this.renderMetrics();
    this.renderWaypointsTimeline();
    this.renderTelemetry();
    this.initLeafletMap();
  },

  renderMetrics() {
    const data = KisanData.logisticsCorridor.traditionalVsAIOptimized;
    const kmEl = document.getElementById('routeKmSaved');
    const timeEl = document.getElementById('routeTimeSaved');
    const fuelEl = document.getElementById('routeFuelSaved');
    const spoilageEl = document.getElementById('routeSpoilageReduced');

    if (kmEl) kmEl.textContent = `${data.kmSaved} km`;
    if (timeEl) timeEl.textContent = `${data.timeSavedHours} hrs`;
    if (fuelEl) fuelEl.textContent = `₹${data.fuelCostSavedINR}`;
    if (spoilageEl) spoilageEl.textContent = `-${data.spoilageReductionPct}%`;
  },

  renderWaypointsTimeline() {
    const container = document.getElementById('waypointsTimeline');
    if (!container) return;

    const waypoints = KisanData.logisticsCorridor.waypoints;
    container.innerHTML = waypoints.map(wp => {
      let statusBadge = 'badge-grade-a';
      if (wp.status === 'Loading') statusBadge = 'badge-warning';
      if (wp.status === 'Scheduled') statusBadge = 'badge-grade-b';

      return `
        <div class="waypoint-item ${wp.type}">
          <div class="waypoint-dot"></div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="waypoint-title">${wp.name}</div>
              <div class="waypoint-meta">${wp.cargo} • ETA: ${wp.pickupTime}</div>
            </div>
            <span class="badge ${statusBadge}">${wp.status}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  renderTelemetry() {
    const v = KisanData.logisticsCorridor.vehicle;
    const container = document.getElementById('telemetryBox');
    if (!container) return;

    container.innerHTML = `
      <div class="telemetry-row">
        <span style="color: var(--text-muted);">Fleet Vehicle:</span>
        <strong>${v.regNumber} (${v.vehicleType})</strong>
      </div>
      <div class="telemetry-row">
        <span style="color: var(--text-muted);">Assigned Driver:</span>
        <span>${v.driverName}</span>
      </div>
      <div class="telemetry-row">
        <span style="color: var(--text-muted);">Reefer Temperature:</span>
        <strong style="color: var(--cyan-400);">${v.temperatureCurrent} (Target: ${v.temperatureTarget})</strong>
      </div>
      <div class="telemetry-row">
        <span style="color: var(--text-muted);">Cargo Humidity:</span>
        <span>${v.humidity} RH</span>
      </div>
      <div class="telemetry-row">
        <span style="color: var(--text-muted);">Spoilage Index:</span>
        <strong style="color: var(--emerald-400);">99.2% Freshness Retained</strong>
      </div>
      <div class="telemetry-row">
        <span style="color: var(--text-muted);">Time to Next Depot:</span>
        <span class="badge badge-warning">${v.etaRemaining}</span>
      </div>
    `;
  },

  initLeafletMap() {
    const mapElement = document.getElementById('logisticsMap');
    if (!mapElement || typeof L === 'undefined') return;

    // Center between Nashik (20.0°N) and Mumbai (19.07°N)
    if (this.map) {
      this.map.remove();
    }

    this.map = L.map('logisticsMap', {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([19.65, 73.5], 8);

    // Dark-themed tile layer (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(this.map);

    this.markersLayer = L.layerGroup().addTo(this.map);

    const waypoints = KisanData.logisticsCorridor.waypoints;
    const latlngs = [];

    // Custom Icon Generator
    const createCustomIcon = (color, symbol) => {
      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background:${color}; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px; box-shadow:0 0 10px ${color}; border:2px solid #fff;">${symbol}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
    };

    waypoints.forEach((wp, idx) => {
      latlngs.push([wp.lat, wp.lng]);
      let color = '#f59e0b';
      let symbol = `${idx + 1}`;
      if (wp.type === 'hub') { color = '#06b6d4'; symbol = 'H'; }
      if (wp.type === 'delivery') { color = '#10b981'; symbol = 'D'; }

      const marker = L.marker([wp.lat, wp.lng], {
        icon: createCustomIcon(color, symbol)
      });

      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; color: #0f172a;">
          <strong style="font-size: 13px;">${wp.name}</strong><br/>
          <span style="font-size: 11px; color: #475569;">${wp.cargo}</span><br/>
          <span style="font-size: 11px; font-weight: 600; color: #059669;">Status: ${wp.status} (${wp.pickupTime})</span>
        </div>
      `);

      this.markersLayer.addLayer(marker);
    });

    // Draw optimized AI route corridor polyline
    this.optimizedPolyline = L.polyline(latlngs, {
      color: '#10b981',
      weight: 4,
      opacity: 0.85,
      dashArray: '8, 6'
    }).addTo(this.map);

    // Fit map bounds to waypoints
    this.map.fitBounds(this.optimizedPolyline.getBounds(), { padding: [40, 40] });
  },

  reOptimizeRoute() {
    MarketplaceModule.showToast("AI Routing Engine: Recalculated dynamic traffic & cluster pickups. Route efficiency +12%!", "success");
    
    // Animate map view briefly
    if (this.map) {
      this.map.flyTo([19.65, 73.5], 9, {
        duration: 1.5
      });
    }
  },

  triggerEmergencyReRoute() {
    // Simulate Highway Blockage & Temperature Rise
    const v = KisanData.logisticsCorridor.vehicle;
    v.temperatureCurrent = "8.4°C (Alert: Rising)";
    v.etaRemaining = "4h 15m (Traffic Stalled)";
    this.renderTelemetry();

    MarketplaceModule.showToast("⚠️ IOT SENSOR ALERT: Reefer temp spiked to 8.4°C! AI re-routing to Thane Processing Hub to prevent spoilage.", "warning");

    // Draw emergency alternate route on map
    if (this.map) {
      const emergencyLatLngs = [
        [20.0334, 73.9100], // Sahyadri Hub
        [19.2183, 72.9781]  // Thane Mega Agro Food Processing Depot
      ];

      L.polyline(emergencyLatLngs, {
        color: '#f59e0b',
        weight: 5,
        dashArray: '5, 5'
      }).addTo(this.map);

      L.marker([19.2183, 72.9781], {
        icon: L.divIcon({
          className: 'emergency-hub-marker',
          html: '<div style="background:#ef4444; color:#fff; padding:3px 8px; border-radius:4px; font-weight:800; font-size:11px; border:1px solid #fff; white-space:nowrap; box-shadow:0 0 12px #ef4444;">🚨 REROUTED: Thane Food Park</div>'
        })
      }).addTo(this.map);

      this.map.flyTo([19.2183, 72.9781], 10, { duration: 1.5 });
    }
  }
};

