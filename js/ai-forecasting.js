/**
 * KisanDirect AI - Dynamic Demand Forecasting & Price Volatility Engine
 * Powered by live REST API /api/forecast/:commodityId
 */

window.AIForecastingModule = {
  currentCommodityId: 'COMM-VEG-01',
  chartInstance: null,

  init() {
    this.populateCommodities();
    this.bindEvents();
    this.fetchAndRenderForecast(this.currentCommodityId);
  },

  populateCommodities() {
    const select = document.getElementById('forecastCommoditySelect');
    if (!select) return;

    select.innerHTML = '';
    const commodities = KisanData.commodities || [];

    // Group by category
    const grouped = {};
    commodities.forEach(c => {
      if (!grouped[c.category]) grouped[c.category] = [];
      grouped[c.category].push(c);
    });

    for (const [cat, list] of Object.entries(grouped)) {
      const optGroup = document.createElement('optgroup');
      optGroup.label = cat;
      list.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${c.standard_unit})`;
        if (c.id === this.currentCommodityId) opt.selected = true;
        optGroup.appendChild(opt);
      });
      select.appendChild(optGroup);
    }
  },

  bindEvents() {
    // Dynamic commodity dropdown selection
    const select = document.getElementById('forecastCommoditySelect');
    if (select) {
      select.addEventListener('change', (e) => {
        this.currentCommodityId = e.target.value;
        this.fetchAndRenderForecast(this.currentCommodityId);
      });
    }

    // Quick-preset buttons if present
    const cropButtons = document.querySelectorAll('.crop-tab-btn');
    cropButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        cropButtons.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const cropKeyword = e.currentTarget.getAttribute('data-crop');
        this.selectCommodityByKeyword(cropKeyword);
      });
    });

    // Festival demand surge simulation button
    const simulateEventBtn = document.getElementById('simulateSurgeBtn');
    if (simulateEventBtn) {
      simulateEventBtn.addEventListener('click', () => {
        this.simulateDemandSpike();
      });
    }
  },

  selectCommodityByKeyword(keyword) {
    const select = document.getElementById('forecastCommoditySelect');
    if (!select) return;

    for (let i = 0; i < select.options.length; i++) {
      const opt = select.options[i];
      if (opt.textContent.toLowerCase().includes(keyword.toLowerCase())) {
        select.selectedIndex = i;
        this.currentCommodityId = opt.value;
        this.fetchAndRenderForecast(this.currentCommodityId);
        break;
      }
    }
  },

  async fetchAndRenderForecast(commodityId) {
    try {
      const res = await fetch(`/api/forecast/${encodeURIComponent(commodityId)}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to fetch forecast');

      this.renderForecastUI(data.forecast);
    } catch (e) {
      console.warn("Forecast fetch warning, using fallback:", e);
      // Fallback display
      this.renderForecastUI({
        crop: "Nashik Red Onion",
        historicalDays: ["Aug 24", "Aug 26", "Aug 28", "Aug 30", "Sep 01", "Sep 03", "Sep 05", "Sep 07"],
        historicalMandiPrice: [15.2, 15.8, 16.0, 16.5, 17.1, 16.8, 17.5, 17.8],
        forecastDays: ["Sep 09", "Sep 11", "Sep 13", "Sep 15", "Sep 17", "Sep 19", "Sep 21"],
        predictedDemandMetric: [1120, 1280, 1450, 1680, 1920, 2100, 1850],
        predictedPriceMin: [25.0, 26.5, 27.8, 29.0, 31.0, 32.5, 30.0],
        predictedPriceMax: [28.5, 30.0, 31.5, 33.5, 35.5, 37.0, 34.0],
        volatilityIndex: "Moderate (Festival Spike Imminent)",
        advisory: "Navratri festival surge anticipated. Stage release 35% of inventory in week 2 to capture peak retail demand without triggering DOCA buffer interventions."
      });
    }
  },

  renderForecastUI(data) {
    const advisoryEl = document.getElementById('forecastAdvisoryText');
    const volatilityEl = document.getElementById('forecastVolatilityBadge');
    const cropNameEl = document.getElementById('forecastCropName');

    if (advisoryEl) advisoryEl.textContent = data.advisory;
    if (volatilityEl) {
      volatilityEl.textContent = data.volatilityIndex;
      if (data.volatilityIndex.includes('High')) {
        volatilityEl.className = 'badge badge-danger';
      } else if (data.volatilityIndex.includes('Moderate')) {
        volatilityEl.className = 'badge badge-warning';
      } else {
        volatilityEl.className = 'badge badge-grade-a';
      }
    }
    if (cropNameEl) cropNameEl.textContent = data.crop;

    this.renderChart(data);
  },

  renderChart(data) {
    const canvas = document.getElementById('demandForecastChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = [...data.historicalDays, ...data.forecastDays];
    
    // Fill historical series with nulls for forecast period
    const histMandiData = [...data.historicalMandiPrice, ...new Array(data.forecastDays.length).fill(null)];
    
    // Connect forecast line from the last historical point
    const lastHistVal = data.historicalMandiPrice[data.historicalMandiPrice.length - 1];
    const forecastPrefix = new Array(data.historicalDays.length - 1).fill(null);
    forecastPrefix.push(lastHistVal);

    const forecastMinData = [...forecastPrefix, ...data.predictedPriceMin];
    const forecastMaxData = [...forecastPrefix, ...data.predictedPriceMax];

    this.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Historical APMC Mandi Rate (₹/unit)',
            data: histMandiData,
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#94a3b8',
            tension: 0.3
          },
          {
            label: 'AI Forecast: Direct Farmer Price Max (₹/unit)',
            data: forecastMaxData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 3,
            borderDash: [5, 5],
            pointRadius: 5,
            pointBackgroundColor: '#10b981',
            fill: '+1',
            tension: 0.3
          },
          {
            label: 'AI Forecast: Direct Farmer Price Min (₹/unit)',
            data: forecastMinData,
            borderColor: '#059669',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 4,
            pointBackgroundColor: '#059669',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 12 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#fff',
            bodyColor: '#cbd5e1',
            borderColor: '#334155',
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                if (context.parsed.y !== null) {
                  return `${context.dataset.label}: ₹${context.parsed.y.toFixed(2)}`;
                }
                return null;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#64748b',
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: function(value) { return '₹' + value; }
            }
          }
        }
      }
    });
  },

  simulateDemandSpike() {
    if (!this.chartInstance) return;

    MarketplaceModule.showToast("Festival Demand Shock Simulation: Adding +35% urban procurement surge!", "info");

    const datasets = this.chartInstance.data.datasets;
    // Boost forecast max and min values
    datasets[1].data = datasets[1].data.map(v => v !== null ? +(v * 1.25).toFixed(1) : null);
    datasets[2].data = datasets[2].data.map(v => v !== null ? +(v * 1.18).toFixed(1) : null);

    this.chartInstance.update();

    const volatilityEl = document.getElementById('forecastVolatilityBadge');
    if (volatilityEl) {
      volatilityEl.textContent = "High Volatility (Festival Demand Shock Applied)";
      volatilityEl.className = 'badge badge-danger';
    }

    const advisoryEl = document.getElementById('forecastAdvisoryText');
    if (advisoryEl) {
      advisoryEl.textContent = "SIMULATED SURGE: Urban retail demand projected +35% across Tier-1 supermarket networks. FPO clusters should route pre-cooled stock immediately via Western Agri-Express corridors to capture maximum farmgate realization before APMC cartels inflate middleman cuts.";
    }
  }
};
