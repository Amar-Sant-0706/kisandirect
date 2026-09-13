/**
 * KisanDirect AI - DOCA Ministry Price Monitoring & Fair Margin Index
 * Department of Consumer Affairs (DOCA)
 */

window.DOCAMonitorModule = {
  async init() {
    await this.renderPriceSpreadTable();
    this.renderMacroMetrics();
    this.bindEvents();
  },

  bindEvents() {
    const bufferBtn = document.getElementById('triggerBufferReleaseBtn');
    if (bufferBtn) {
      bufferBtn.addEventListener('click', () => {
        this.simulateBufferIntervention();
      });
    }
  },

  async renderPriceSpreadTable() {
    const tbody = document.getElementById('docaTableBody');
    if (!tbody) return;

    let data = KisanData.docaPriceWatch || [];
    if (data.length === 0) {
      try {
        const res = await fetch('/api/doca/surveillance');
        const json = await res.json();
        if (json.success) {
          data = json.surveillance;
          KisanData.docaPriceWatch = data;
        }
      } catch (e) {
        console.warn("Surveillance fetch error:", e);
      }
    }

    if (data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading live national mandi surveillance data...</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(row => {
      let riskBadge = 'badge-grade-a';
      if (row.riskLevel.includes('Moderate')) riskBadge = 'badge-warning';
      if (row.riskLevel.includes('High')) riskBadge = 'badge-danger';

      return `
        <tr>
          <td>
            <strong>${row.commodity}</strong><br/>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${row.state} (${row.keyMandi})</span>
          </td>
          <td style="color: var(--emerald-400); font-weight: 600;">${row.farmgateAvgPrice}</td>
          <td>${row.mandiWholesalePrice}</td>
          <td style="color: var(--rose-400); font-weight: 700; text-decoration: line-through;">${row.retailUrbanPrice}</td>
          <td style="color: var(--emerald-400); font-weight: 700;">${row.kisanDirectPrice}</td>
          <td>
            <span style="color: var(--rose-400); font-size: 0.8rem; font-weight: 600;">Mandi: ${row.priceSpreadPct}</span><br/>
            <span style="color: var(--emerald-400); font-size: 0.75rem;">Direct: ${row.kisanDirectSpreadPct}</span>
          </td>
          <td>
            <span style="color: var(--emerald-400); font-weight: 700;">${row.farmerGainPct}</span>
          </td>
          <td>
            <span style="color: var(--amber-400); font-weight: 700;">${row.consumerSavingPct}</span>
          </td>
          <td>
            <span class="badge ${riskBadge}">${row.riskLevel}</span>
          </td>
        </tr>
      `;
    }).join('');
  },

  renderMacroMetrics() {
    const impactFarmers = document.getElementById('docaImpactFarmers');
    const impactSavings = document.getElementById('docaImpactSavings');
    const impactMiddlemenEliminated = document.getElementById('docaImpactMiddlemen');

    const totalComms = (KisanData.commodities || []).length;

    if (impactFarmers) impactFarmers.textContent = "+46.8% Net";
    if (impactSavings) impactSavings.textContent = "-24.6% Avg";
    if (impactMiddlemenEliminated) impactMiddlemenEliminated.textContent = `₹${(totalComms * 9.2).toFixed(1)} Cr`;
  },

  simulateBufferIntervention() {
    MarketplaceModule.showToast("DOCA Price Stabilization Alert: 5,000 MT strategic buffer released via KisanDirect FPO logistics corridor. Urban retail prices stabilized!", "info");
    
    const targetRow = (KisanData.docaPriceWatch || []).find(r => r.commodity.includes("Onion") || r.commodity.includes("Tomato"));
    if (targetRow) {
      targetRow.retailUrbanPrice = "₹ 24.00 / kg (Stabilized)";
      targetRow.riskLevel = "Intervened / Normal";
      this.renderPriceSpreadTable();
    }
  }
};
