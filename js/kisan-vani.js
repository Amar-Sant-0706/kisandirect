/**
 * KisanDirect AI - Multilingual AI Voice Copilot (Kisan Vani)
 * Broadcasts daily updated market prices and farmer gain rates in 9 Indian languages
 * with Real-Time Role Voice Actor & Pitch Changing (Farmer, Buyer, Admin).
 */

window.KisanVaniModule = {
  currentLanguage: 'hi',
  currentCommodityId: '',
  currentRolePersona: 'FARMER', // 'FARMER', 'BUYER', 'ADMIN'
  isSpeaking: false,
  isPaused: false,
  currentUtterance: null,
  cachedBulletin: null,
  availableVoices: [],

  SUPPORTED_LANGUAGES: [
    { code: 'hi', name: 'हिन्दी (Hindi)', locale: 'hi-IN', flag: '🇮🇳' },
    { code: 'en', name: 'English', locale: 'en-IN', flag: '🇬🇧' },
    { code: 'mr', name: 'मराठी (Marathi)', locale: 'mr-IN', flag: '🇮🇳' },
    { code: 'te', name: 'తెలుగు (Telugu)', locale: 'te-IN', flag: '🇮🇳' },
    { code: 'ta', name: 'தமிழ் (Tamil)', locale: 'ta-IN', flag: '🇮🇳' },
    { code: 'gu', name: 'ગુજરાતી (Gujarati)', locale: 'gu-IN', flag: '🇮🇳' },
    { code: 'kn', name: 'ಕನ್ನಡ (Kannada)', locale: 'kn-IN', flag: '🇮🇳' },
    { code: 'bn', name: 'বাংলা (Bengali)', locale: 'bn-IN', flag: '🇮🇳' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)', locale: 'pa-IN', flag: '🇮🇳' }
  ],

  init() {
    this.populateCommodityFilter();
    this.renderLanguageChips();
    this.loadSystemVoices();
  },

  loadSystemVoices() {
    if ('speechSynthesis' in window) {
      this.availableVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.availableVoices = window.speechSynthesis.getVoices();
      };
    }
  },

  setVoicePersona(persona) {
    this.currentRolePersona = persona;
    const btnFarmer = document.getElementById('voiceRoleFarmer');
    const btnBuyer = document.getElementById('voiceRoleBuyer');
    const btnAdmin = document.getElementById('voiceRoleAdmin');

    if (btnFarmer) btnFarmer.className = 'voice-role-btn ' + (persona === 'FARMER' ? 'active' : '');
    if (btnBuyer) btnBuyer.className = 'voice-role-btn ' + (persona === 'BUYER' ? 'active' : '');
    if (btnAdmin) btnAdmin.className = 'voice-role-btn ' + (persona === 'ADMIN' ? 'active' : '');

    // If currently speaking, dynamically restart with the newly selected role voice!
    if (this.isSpeaking) {
      this.stopSpeaking();
      this.playVoice();
    }
  },

  async fetchBulletin(lang = this.currentLanguage, commodityId = this.currentCommodityId) {
    try {
      let url = `/api/voice/bulletin?lang=${lang}`;
      if (commodityId) url += `&commodityId=${commodityId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        this.cachedBulletin = data;
        this.renderBulletinDetails(data);
        return data;
      }
    } catch (err) {
      console.error('Error fetching voice bulletin:', err);
    }
    return null;
  },

  renderLanguageChips() {
    const container = document.getElementById('vaniLangChips');
    if (!container) return;

    container.innerHTML = this.SUPPORTED_LANGUAGES.map(l => `
      <button class="voice-lang-chip ${l.code === this.currentLanguage ? 'active' : ''}" 
        onclick="KisanVaniModule.setLanguage('${l.code}')">
        <span>${l.flag}</span> ${l.name}
      </button>
    `).join('');
  },

  async populateCommodityFilter() {
    const select = document.getElementById('vaniCommoditySelect');
    if (!select) return;

    try {
      const res = await fetch('/api/commodities');
      const data = await res.json();
      if (data.success && data.commodities) {
        let opts = `<option value="">🌾 All Top Commodities (Full Daily Bulletin)</option>`;
        for (const c of data.commodities) {
          opts += `<option value="${c.id}">${c.name} (${c.standard_unit})</option>`;
        }
        select.innerHTML = opts;
      }
    } catch (e) {
      console.warn('Could not populate commodity filter:', e);
    }
  },

  renderBulletinDetails(data) {
    const transcriptEl = document.getElementById('vaniTranscript');
    const headlineEl = document.getElementById('vaniHeadline');
    const dateEl = document.getElementById('vaniDateBadge');

    if (transcriptEl) transcriptEl.textContent = data.audioText;
    if (headlineEl) headlineEl.textContent = data.headline || 'Daily Agri Market Bulletin';
    if (dateEl) dateEl.textContent = `Live: ${data.date}`;

    const ratesGrid = document.getElementById('vaniRatesPreview');
    if (ratesGrid && data.ratesSummary) {
      ratesGrid.innerHTML = data.ratesSummary.map(r => `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 8px 12px; font-size: 0.8rem;">
          <div style="font-weight: 700; color: #fff;">${r.name}</div>
          <div style="color: var(--emerald-400); font-weight: 700;">₹${r.direct_farmgate_rate}/${r.standard_unit}</div>
          <div style="color: var(--text-muted); font-size: 0.72rem;">Mandi: ₹${r.base_mandi_benchmark} (+${r.farmer_gain_pct}% farmer gain)</div>
        </div>
      `).join('');
    }
  },

  async setLanguage(langCode) {
    this.currentLanguage = langCode;
    this.renderLanguageChips();
    const bulletin = await this.fetchBulletin(langCode, this.currentCommodityId);
    if (this.isSpeaking) {
      this.stopSpeaking();
      if (bulletin) this.playVoice();
    }
  },

  async onCommodityChange(commId) {
    this.currentCommodityId = commId;
    await this.fetchBulletin(this.currentLanguage, commId);
    if (this.isSpeaking) {
      this.stopSpeaking();
      this.playVoice();
    }
  },

  // Dynamic Voice Persona Profile Configuration
  getPersonaVoiceConfig(langLocale) {
    const persona = this.currentRolePersona;
    let pitch = 1.0;
    let rate = 0.95;

    if (persona === 'FARMER') {
      // Deeper, rustic, grounded baritone tone
      pitch = 0.82;
      rate = 0.88;
    } else if (persona === 'BUYER') {
      // Brisk, crisp, energetic commercial tone
      pitch = 1.22;
      rate = 1.08;
    } else if (persona === 'ADMIN') {
      // Authoritative, calm, clear broadcast tone
      pitch = 1.00;
      rate = 0.98;
    }

    // Select suitable voice actor from browser voice pool
    const voices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
    let selectedVoice = null;

    // Filter matching language
    const langMatches = voices.filter(v => 
      v.lang === langLocale || 
      v.lang.replace('_', '-').startsWith(this.currentLanguage)
    );

    if (langMatches.length > 0) {
      if (persona === 'BUYER') {
        // Prefer female or higher pitched voice actor
        selectedVoice = langMatches.find(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('zira') || 
          v.name.toLowerCase().includes('google') ||
          v.name.toLowerCase().includes('kalpana')
        ) || langMatches[0];
      } else if (persona === 'FARMER') {
        // Prefer male or lower pitched voice actor
        selectedVoice = langMatches.find(v => 
          v.name.toLowerCase().includes('male') || 
          v.name.toLowerCase().includes('david') || 
          v.name.toLowerCase().includes('ravi') || 
          v.name.toLowerCase().includes('hemant')
        ) || langMatches[langMatches.length - 1];
      } else {
        selectedVoice = langMatches[0];
      }
    }

    return { pitch, rate, selectedVoice };
  },

  async playVoice() {
    if (!('speechSynthesis' in window)) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }

    if (this.isPaused) {
      window.speechSynthesis.resume();
      this.isPaused = false;
      this.isSpeaking = true;
      this.updateSpeakingUI(true);
      return;
    }

    if (!this.cachedBulletin) {
      await this.fetchBulletin();
    }

    if (!this.cachedBulletin || !this.cachedBulletin.audioText) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(this.cachedBulletin.audioText);
    const targetLocale = this.cachedBulletin.locale || 'hi-IN';
    utterance.lang = targetLocale;

    // Apply Persona Voice Tuning
    const personaConfig = this.getPersonaVoiceConfig(targetLocale);
    utterance.pitch = personaConfig.pitch;
    utterance.rate = personaConfig.rate;

    if (personaConfig.selectedVoice) {
      utterance.voice = personaConfig.selectedVoice;
    }

    this.currentUtterance = utterance;
    this.isSpeaking = true;
    this.isPaused = false;
    this.updateSpeakingUI(true);

    utterance.onend = () => {
      this.isSpeaking = false;
      this.isPaused = false;
      this.updateSpeakingUI(false);
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis utterance error:', e);
      this.isSpeaking = false;
      this.isPaused = false;
      this.updateSpeakingUI(false);
    };

    window.speechSynthesis.speak(utterance);
  },

  pauseVoice() {
    if (this.isSpeaking && !this.isPaused) {
      window.speechSynthesis.pause();
      this.isPaused = true;
      this.updateSpeakingUI(false, true);
    }
  },

  stopSpeaking() {
    window.speechSynthesis.cancel();
    this.isSpeaking = false;
    this.isPaused = false;
    this.updateSpeakingUI(false);
  },

  updateSpeakingUI(speaking, paused = false) {
    const eq = document.getElementById('vaniEqualizer');
    const playBtn = document.getElementById('vaniPlayBtn');
    const navText = document.getElementById('voiceIndicatorText');

    if (eq) {
      if (speaking) eq.classList.add('active');
      else eq.classList.remove('active');
    }

    if (playBtn) {
      if (speaking) {
        playBtn.innerHTML = `<i data-lucide="pause"></i> Pause Audio`;
        playBtn.onclick = () => KisanVaniModule.pauseVoice();
      } else if (paused) {
        playBtn.innerHTML = `<i data-lucide="play"></i> Resume Audio`;
        playBtn.onclick = () => KisanVaniModule.playVoice();
      } else {
        playBtn.innerHTML = `<i data-lucide="volume-2"></i> Play Voice Broadcast`;
        playBtn.onclick = () => KisanVaniModule.playVoice();
      }
    }

    if (navText) {
      const roleLabel = this.currentRolePersona === 'FARMER' ? 'Farmer' : (this.currentRolePersona === 'BUYER' ? 'Buyer' : 'Admin');
      navText.textContent = speaking ? `Broadcasting (${roleLabel})...` : "Kisan Vani Voice";
    }

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
  },

  openVoiceModal() {
    const modal = document.getElementById('kisanVaniModal');
    if (modal) {
      modal.classList.add('open');
      this.init();
      this.fetchBulletin();
    }
  },

  closeVoiceModal() {
    const modal = document.getElementById('kisanVaniModal');
    if (modal) modal.classList.remove('open');
  }
};
